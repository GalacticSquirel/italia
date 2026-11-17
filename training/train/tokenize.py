"""Tokenise chat examples with loss only on the tutor's (assistant) turns.

Assistant spans are found by rendering growing prefixes of the conversation with the model's own
chat template, so this works for any template whose rendering of a prefix is a prefix of the
rendering of the whole conversation (true for the Gemma and Qwen templates in non-thinking mode).
The template's own BOS handling is kept; no special tokens are added twice.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

IGNORE_INDEX = -100


class ChatTokenizer(Protocol):
    """The subset of a Hugging Face tokenizer this module uses."""

    def apply_chat_template(
        self,
        conversation: Sequence[Mapping[str, str]],
        *,
        tokenize: bool,
        add_generation_prompt: bool,
        **kwargs: Any,
    ) -> Any: ...


@dataclass(frozen=True)
class TokenizedExample:
    input_ids: list[int]
    labels: list[int]

    @property
    def trainable_tokens(self) -> int:
        return sum(1 for label in self.labels if label != IGNORE_INDEX)


class TemplateMismatchError(ValueError):
    """The chat template does not render prefixes as prefixes."""


def _ids(
    tokenizer: ChatTokenizer,
    messages: Sequence[Mapping[str, str]],
    *,
    gen: bool,
    template_kwargs: Mapping[str, Any],
) -> list[int]:
    out = tokenizer.apply_chat_template(
        list(messages), tokenize=True, add_generation_prompt=gen, **template_kwargs
    )
    if isinstance(out, Mapping):  # some tokenizers return a BatchEncoding
        out = out["input_ids"]
    return [int(t) for t in out]


def tokenize_conversation(
    tokenizer: ChatTokenizer,
    messages: Sequence[Mapping[str, str]],
    *,
    max_length: int,
    template_kwargs: Mapping[str, Any] | None = None,
) -> TokenizedExample | None:
    """Input ids and labels (assistant tokens only). None if no assistant token fits."""
    kwargs = dict(template_kwargs or {})
    full = _ids(tokenizer, messages, gen=False, template_kwargs=kwargs)
    labels = [IGNORE_INDEX] * len(full)
    for index, message in enumerate(messages):
        if message["role"] != "assistant":
            continue
        start_ids = _ids(tokenizer, messages[:index], gen=True, template_kwargs=kwargs)
        end_ids = _ids(tokenizer, messages[: index + 1], gen=False, template_kwargs=kwargs)
        start, end = len(start_ids), len(end_ids)
        if full[:start] != start_ids or full[:end] != end_ids:
            raise TemplateMismatchError(
                "chat template is not prefix-stable; check the template's thinking options"
            )
        labels[start:end] = full[start:end]
    input_ids = full[:max_length]
    labels = labels[:max_length]
    example = TokenizedExample(input_ids=input_ids, labels=labels)
    return example if example.trainable_tokens else None


def tokenize_completion(
    tokenizer: ChatTokenizer,
    prompt: Sequence[Mapping[str, str]],
    answer: Mapping[str, str],
    *,
    max_length: int,
    template_kwargs: Mapping[str, Any] | None = None,
) -> TokenizedExample | None:
    """One answer after a multi-turn prompt, with loss only on that answer (DPO).

    Earlier assistant turns in the prompt are context, not targets. Returns None when the whole
    sequence does not fit: a preference pair with a truncated answer would compare halves.
    """
    kwargs = dict(template_kwargs or {})
    start_ids = _ids(tokenizer, prompt, gen=True, template_kwargs=kwargs)
    full = _ids(tokenizer, [*prompt, answer], gen=False, template_kwargs=kwargs)
    if full[: len(start_ids)] != start_ids:
        raise TemplateMismatchError(
            "chat template is not prefix-stable; check the template's thinking options"
        )
    if len(full) > max_length or len(full) == len(start_ids):
        return None
    labels = [IGNORE_INDEX] * len(start_ids) + full[len(start_ids) :]
    return TokenizedExample(input_ids=full, labels=labels)


def pad_batch(
    examples: Sequence[TokenizedExample], pad_token_id: int
) -> dict[str, list[list[int]]]:
    """Right-pad to the longest example: input_ids, attention_mask, labels."""
    width = max(len(e.input_ids) for e in examples)
    batch: dict[str, list[list[int]]] = {"input_ids": [], "attention_mask": [], "labels": []}
    for e in examples:
        pad = width - len(e.input_ids)
        batch["input_ids"].append(e.input_ids + [pad_token_id] * pad)
        batch["attention_mask"].append([1] * len(e.input_ids) + [0] * pad)
        batch["labels"].append(e.labels + [IGNORE_INDEX] * pad)
    return batch


def merge_system_message(messages: Sequence[Mapping[str, str]]) -> list[dict[str, str]]:
    """For templates without a system role: prepend the system text to the first user turn."""
    out = [dict(m) for m in messages]
    if out and out[0]["role"] == "system":
        system = out.pop(0)["content"]
        if out and out[0]["role"] == "user":
            out[0]["content"] = f"{system}\n\n{out[0]['content']}"
        else:
            out.insert(0, {"role": "user", "content": system})
    return out
