# Hand-written tutor dialogues

Dialogues written by hand (not by the teacher model) to supplement generated data where it is
thin. They follow the same contract and pass the same filters as generated dialogues.

- `src/<set>/*.yaml`: sources in the compact format documented in `datagen/handwritten.py`
- `<set>.jsonl`: compiled `DialogueRecord`s that passed every filter (`teacher: handwritten`)

One set per level or theme (`a1`, `a2`, `b1`, `b2`, `corrections`, ...). Only train-split
scenarios are allowed; evaluation scenarios are rejected.

```sh
# LanguageTool on :8010 (Docker, or the standalone zip from languagetool.org:
#   java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8010)
uv run python -m datagen.handwritten check a1        # print failures
uv run python -m datagen.handwritten build --all     # write <set>.jsonl for every set

# add them to the SFT data (paths relative to training/)
uv run python -m datagen build-sft -c datagen/configs/local-mac.yaml --out work/sft \
  --extra 'data/handwritten/*.jsonl'
```
