"""Sample several tutor turns per DPO prompt from the SFT model (for judge ranking).

    uv run python -m train.sample --model out/sft-gemma4-e4b-full/final \\
        --prompts work/dpo/prompts.jsonl --out work/dpo/candidates.jsonl -k 4

Output rows: {"prompt": <DpoPrompt>, "samples": [str, ...]}; resumable by prompt id.
For large runs, serve the model with vLLM and use `python -m eval predict` style sampling
instead; this script keeps the dependency set small.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

from datagen.jsonutil import JsonlAppender, read_jsonl
from train.common import seed_everything
from train.tokenize import merge_system_message


def chunks(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(prog="python -m train.sample")
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompts", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("-k", type=int, default=4)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--top-p", type=float, default=0.95)
    parser.add_argument("--max-new-tokens", type=int, default=400)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--merge-system", action="store_true")
    parser.add_argument("--seed", type=int, default=20261115)
    parser.add_argument(
        "--loader",
        choices=["causal-lm", "image-text-to-text"],
        default="causal-lm",
        help="Auto class (Gemma 4 checkpoints: the second)",
    )
    args = parser.parse_args(argv)

    import torch
    from transformers import AutoModelForCausalLM, AutoModelForImageTextToText, AutoTokenizer

    seed_everything(args.seed, deterministic=False)
    tokenizer = AutoTokenizer.from_pretrained(args.model, padding_side="left")
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    cls = (
        AutoModelForImageTextToText if args.loader == "image-text-to-text" else AutoModelForCausalLM
    )
    model = cls.from_pretrained(args.model, dtype=torch.bfloat16, device_map="auto")
    model.eval()
    out_path = Path(args.out)
    done = {row["prompt"]["id"] for row in read_jsonl(out_path)}
    todo = [r for r in read_jsonl(Path(args.prompts)) if r["id"] not in done]
    with JsonlAppender(out_path) as out:
        for batch in chunks(todo, args.batch_size):
            texts = []
            for row in batch:
                messages = row["messages"]
                if args.merge_system:
                    messages = merge_system_message(messages)
                texts.append(
                    tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                )
            enc = tokenizer(texts, return_tensors="pt", padding=True, add_special_tokens=False).to(
                model.device
            )
            with torch.no_grad():
                generated = model.generate(
                    **enc,
                    do_sample=True,
                    temperature=args.temperature,
                    top_p=args.top_p,
                    max_new_tokens=args.max_new_tokens,
                    num_return_sequences=args.k,
                    pad_token_id=tokenizer.pad_token_id,
                )
            new_tokens = generated[:, enc["input_ids"].shape[1] :]
            decoded = tokenizer.batch_decode(new_tokens, skip_special_tokens=True)
            for i, row in enumerate(batch):
                samples = [s.strip() for s in decoded[i * args.k : (i + 1) * args.k]]
                out.append({"prompt": row, "samples": samples})
    print(f"sampled {len(todo)} prompts -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
