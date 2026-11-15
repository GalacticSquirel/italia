"""Supervised fine-tuning on teacher dialogues (loss on tutor turns only).

    # LoRA on one GPU (fast iteration, bake-off):
    uv run python -m train.sft -c train/configs/sft-gemma4-e4b-lora.yaml
    # Full fine-tune on 8 GPUs with FSDP:
    uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \\
        -m train.sft -c train/configs/sft-gemma4-e4b-full.yaml
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

from train.common import (
    load_full_model,
    load_rows,
    load_tokenizer,
    prepare_messages,
    seed_everything,
    stable_subset,
)
from train.config import SftConfig, load_sft_config, trainer_arguments
from train.tokenize import TokenizedExample, pad_batch, tokenize_conversation

log = logging.getLogger("train.sft")


def tokenize_rows(
    rows: list[dict[str, Any]], tokenizer: Any, config: SftConfig
) -> list[TokenizedExample]:
    out: list[TokenizedExample] = []
    skipped = 0
    for row in rows:
        example = tokenize_conversation(
            tokenizer,
            prepare_messages(row["messages"], config.base_model),
            max_length=config.max_seq_length,
            template_kwargs=config.base_model.chat_template_kwargs,
        )
        if example is None:
            skipped += 1
        else:
            out.append(example)
    if skipped:
        log.warning("skipped %d examples with no trainable tokens after truncation", skipped)
    return out


def load_model_and_tokenizer(config: SftConfig) -> tuple[Any, Any]:
    base = config.base_model
    if config.backend == "unsloth":
        from unsloth import FastModel

        model, tokenizer = FastModel.from_pretrained(
            model_name=base.id,
            max_seq_length=config.max_seq_length,
            load_in_4bit=config.load_in_4bit,
            full_finetuning=config.method == "full",
        )
        if config.method == "lora":
            assert config.lora is not None
            model = FastModel.get_peft_model(
                model,
                finetune_vision_layers=False,
                finetune_language_layers=True,
                finetune_attention_modules=True,
                finetune_mlp_modules=True,
                r=config.lora.r,
                lora_alpha=config.lora.alpha,
                lora_dropout=config.lora.dropout,
                bias="none",
                random_state=config.seed,
                use_gradient_checkpointing="unsloth" if config.gradient_checkpointing else False,
            )
        tokenizer = getattr(tokenizer, "tokenizer", tokenizer)  # processors wrap the tokenizer
        if tokenizer.pad_token_id is None:
            tokenizer.pad_token = tokenizer.eos_token
        return model, tokenizer

    tokenizer = load_tokenizer(base)
    model = load_full_model(base)
    if config.method == "lora":
        from peft import LoraConfig, get_peft_model

        assert config.lora is not None
        model = get_peft_model(
            model,
            LoraConfig(
                r=config.lora.r,
                lora_alpha=config.lora.alpha,
                lora_dropout=config.lora.dropout,
                target_modules=config.lora.target_modules,
                task_type="CAUSAL_LM",
            ),
        )
    return model, tokenizer


class ExampleDataset:
    def __init__(self, examples: list[TokenizedExample]) -> None:
        self.examples = examples

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> TokenizedExample:
        return self.examples[index]


def run(config: SftConfig) -> Path:
    if config.backend == "unsloth":
        import unsloth  # noqa: F401  - must be imported before transformers to patch it
    import torch
    from transformers import Trainer, TrainingArguments

    seed_everything(config.seed, config.deterministic)
    model, tokenizer = load_model_and_tokenizer(config)
    train_rows = stable_subset(load_rows(config.train_file), config.max_train_examples, config.seed)
    train = tokenize_rows(train_rows, tokenizer, config)
    val = tokenize_rows(load_rows(config.val_file), tokenizer, config) if config.val_file else []
    trainable = sum(e.trainable_tokens for e in train)
    log.info("train: %d examples, %.1fM trainable tokens", len(train), trainable / 1e6)

    def collate(batch: list[TokenizedExample]) -> dict[str, Any]:
        padded = pad_batch(batch, tokenizer.pad_token_id)
        return {k: torch.tensor(v) for k, v in padded.items()}

    args = trainer_arguments(config)
    if not val:
        args["eval_strategy"] = "no"
    trainer = Trainer(
        model=model,
        args=TrainingArguments(**args),
        train_dataset=ExampleDataset(train),
        eval_dataset=ExampleDataset(val) if val else None,
        data_collator=collate,
    )
    trainer.train()
    final = config.output_dir / "final"
    trainer.save_model(str(final))
    tokenizer.save_pretrained(str(final))
    (final / "italia-train-config.json").write_text(
        json.dumps(config.model_dump(mode="json", by_alias=True), indent=2)
    )
    return final


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(prog="python -m train.sft")
    parser.add_argument("-c", "--config", required=True)
    args = parser.parse_args(argv)
    final = run(load_sft_config(Path(args.config)))
    print(f"saved {final}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
