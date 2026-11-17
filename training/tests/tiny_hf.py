"""A tiny Hugging Face-format checkpoint (llama layout, byte-level BPE, chat template) for
end-to-end MLX tests: train, preference-tune and export without downloading a model."""

from __future__ import annotations

import json
from pathlib import Path

TEMPLATE = (
    "{{ bos_token }}{% for m in messages %}<|{{ m['role'] }}|>{{ m['content'] }}<|end|>"
    "{% endfor %}{% if add_generation_prompt %}<|assistant|>{% endif %}"
)
SPECIAL = ["<pad>", "<unk>", "<s>", "</s>", "<|user|>", "<|assistant|>", "<|system|>", "<|end|>"]


def write_tiny_checkpoint(out: Path, hidden: int = 32, layers: int = 2) -> Path:
    import mlx.core as mx
    from tokenizers import Tokenizer, decoders, models, pre_tokenizers, trainers
    from transformers import PreTrainedTokenizerFast

    out.mkdir(parents=True, exist_ok=True)
    tok = Tokenizer(models.BPE(unk_token="<unk>"))
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(
        vocab_size=300,
        special_tokens=SPECIAL,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
    )
    tok.train_from_iterator(['Ciao! Vorrei un caffè, per favore. {"reply": "Certo"}'] * 20, trainer)
    fast = PreTrainedTokenizerFast(
        tokenizer_object=tok,
        bos_token="<s>",
        eos_token="</s>",
        pad_token="<pad>",
        unk_token="<unk>",
    )
    fast.chat_template = TEMPLATE
    fast.save_pretrained(out)
    vocab = len(fast)
    heads, kv, head_dim, inter = 4, 2, hidden // 4, hidden * 2
    config = {
        "model_type": "llama",
        "architectures": ["LlamaForCausalLM"],
        "hidden_size": hidden,
        "num_hidden_layers": layers,
        "intermediate_size": inter,
        "num_attention_heads": heads,
        "num_key_value_heads": kv,
        "head_dim": head_dim,
        "rms_norm_eps": 1e-5,
        "vocab_size": vocab,
        "max_position_embeddings": 512,
        "rope_theta": 10000.0,
        "tie_word_embeddings": False,
        "torch_dtype": "bfloat16",
        "bos_token_id": 2,
        "eos_token_id": 3,
    }
    (out / "config.json").write_text(json.dumps(config), encoding="utf-8")
    shapes: dict[str, tuple[int, ...]] = {
        "model.embed_tokens.weight": (vocab, hidden),
        "model.norm.weight": (hidden,),
        "lm_head.weight": (vocab, hidden),
    }
    for i in range(layers):
        p = f"model.layers.{i}."
        shapes |= {
            p + "self_attn.q_proj.weight": (heads * head_dim, hidden),
            p + "self_attn.k_proj.weight": (kv * head_dim, hidden),
            p + "self_attn.v_proj.weight": (kv * head_dim, hidden),
            p + "self_attn.o_proj.weight": (hidden, heads * head_dim),
            p + "mlp.gate_proj.weight": (inter, hidden),
            p + "mlp.up_proj.weight": (inter, hidden),
            p + "mlp.down_proj.weight": (hidden, inter),
            p + "input_layernorm.weight": (hidden,),
            p + "post_attention_layernorm.weight": (hidden,),
        }
    mx.random.seed(0)
    tensors = {
        k: (mx.ones(s) if len(s) == 1 else mx.random.normal(s) * 0.05).astype(mx.bfloat16)
        for k, s in shapes.items()
    }
    mx.save_safetensors(str(out / "model.safetensors"), tensors, metadata={"format": "pt"})
    return out


def write_tiny_data(sft: Path, pairs: Path) -> None:
    rows = []
    for i in range(16):
        rows.append(
            {
                "id": f"d{i}",
                "messages": [
                    {"role": "system", "content": "Sei un tutor."},
                    {"role": "user", "content": "[inizio]"},
                    {"role": "assistant", "content": '{"reply": "Ciao!"}'},
                    {"role": "user", "content": "Vorrei un caffè" * (1 + i % 3)},
                    {"role": "assistant", "content": '{"reply": "Certo, un caffè."}'},
                ],
            }
        )
    sft.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    pair_rows = [
        {
            "id": f"p{i}:0:0",
            "prompt": rows[i]["messages"][:4],
            "chosen": [{"role": "assistant", "content": '{"reply": "Certo, un caffè."}'}],
            "rejected": [{"role": "assistant", "content": '{"reply": "caffè caffè"}'}],
        }
        for i in range(12)
    ]
    pairs.write_text("".join(json.dumps(r) + "\n" for r in pair_rows), encoding="utf-8")
