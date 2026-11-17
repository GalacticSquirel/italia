# Parity benchmark

Hand-written held-out dialogues that measure the tutor model against a reference written at the
level of the best hosted tutors. They use only `split: eval` scenarios, so no training data ever
shares a scenario with them, and compile to `split: eval` records that `load_handwritten` and
`build-sft --extra` never load.

- `src/bench-<level>/*.yaml`: sources, in the format of `datagen/handwritten.py`. Every corrected
  learner turn carries `gold: {text, fix}` (its wrong span and the correction), and when a turn has
  several errors the tutor addresses the one the policy picks, so the gold move is unambiguous.
- `bench-<level>.jsonl`: compiled records that passed every filter.

```sh
uv run python -m datagen.handwritten check --bench bench-a1
uv run python -m datagen.handwritten build --bench --all
uv run python -m eval build-items --records 'data/bench/*.jsonl' --out work/eval/bench.jsonl
```

See "The parity benchmark" in `training/README.md` for predicting and reporting.
