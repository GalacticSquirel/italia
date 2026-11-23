"""Reproduce mlx-lm's ArraysCache.advance() Metal buffer leak under continuous batching.

Tiny random Qwen3-Next (63 GatedDeltaNet layers + 1 attention layer), driven through the same
BatchGenerator that mlx_lm.server uses. Unpatched, every decode step leaves one lazy
`left_padding - 1` node (one live Metal buffer) on each linear layer whose mask is never built,
so it dies with "[metal::malloc] Resource limit (499000) exceeded" after ~499000/62 ≈ 8k steps.

usage: python repro_leak.py [--patched] [--steps 20000]
"""

import argparse
import hashlib
import random
import sys
import time

import mlx.core as mx
from mlx_lm.generate import BatchGenerator
from mlx_lm.models.qwen3_next import Model, ModelArgs

parser = argparse.ArgumentParser()
parser.add_argument("--patched", action="store_true")
parser.add_argument("--steps", type=int, default=20000)
args = parser.parse_args()

if args.patched:
    sys.path.insert(0, ".")
    from datagen.mlx_compat import patch_arrays_cache

    print("patch applied:", patch_arrays_cache())

mx.random.seed(0)
model = Model(
    ModelArgs(
        model_type="qwen3_next",
        hidden_size=64,
        num_hidden_layers=64,
        intermediate_size=64,
        num_attention_heads=2,
        linear_num_value_heads=2,
        linear_num_key_heads=2,
        linear_key_head_dim=16,
        linear_value_head_dim=16,
        linear_conv_kernel_dim=4,
        num_experts=4,
        num_experts_per_tok=2,
        decoder_sparse_step=1,
        shared_expert_intermediate_size=64,
        mlp_only_layers=[],
        moe_intermediate_size=32,
        rms_norm_eps=1e-6,
        vocab_size=256,
        num_key_value_heads=1,
        rope_theta=10000.0,
        partial_rotary_factor=0.25,
        max_position_embeddings=65536,
        head_dim=16,
        full_attention_interval=64,
    )
)
model.eval()
mx.eval(model.parameters())

rng = random.Random(0)
gen = BatchGenerator(model, max_tokens=100000, completion_batch_size=8, prefill_batch_size=4)


def prompt() -> list[int]:
    return [rng.randrange(1, 256) for _ in range(rng.randint(5, 40))]  # ragged -> left padding


# Each sequence gets 300-1200 tokens, like a dialogue; finished ones are replaced (continuous
# batching), so the generation batch is filtered and extended many times along the way.
live = set(gen.insert([prompt() for _ in range(8)], max_tokens=[rng.randint(300, 1200) for _ in range(8)]))
steps = 0
t0 = time.time()
digest = hashlib.sha256()
reported = False
try:
    while steps < args.steps:
        _, responses = gen.next()
        if responses:
            steps += 1
        for r in responses:
            if steps <= 3000:
                digest.update(f"{r.uid}:{r.token},".encode())
            if steps == 3000 and not reported:
                print("token sha256 over first 3000 steps:", digest.hexdigest()[:16], flush=True)
                reported = True
            if r.finish_reason is not None:
                live.discard(r.uid)
        missing = 8 - len(live)
        if missing:
            live.update(gen.insert([prompt() for _ in range(missing)], max_tokens=[rng.randint(300, 1200) for _ in range(missing)]))
        if steps % 2000 == 0 and responses:
            print(f"step {steps}  active {mx.get_active_memory() / 2**20:.0f} MiB  {time.time() - t0:.0f}s", flush=True)
except RuntimeError as err:
    print(f"CRASHED at step {steps}: {err}")
    sys.exit(1)
print(f"OK: {steps} decode steps without hitting the resource limit ({time.time() - t0:.0f}s)")
