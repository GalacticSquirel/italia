# training: the on-device tutor model programme

This folder builds the Italian conversation tutor that runs on the phone through `llama.rn`. It is
a Python 3.12 project managed with [uv](https://docs.astral.sh/uv/). It is separate from the
pnpm workspace, and Prettier and ESLint ignore it.

The pipeline is **sequence-level distillation**. A large teacher model, reached through any
OpenAI- or Anthropic-compatible API, writes about 40k level-controlled tutoring dialogues. They
contain injected learner errors, prompt-then-recast feedback and structured annotations. The
pipeline filters and judges them, then fine-tunes **Gemma 4 E4B** (primary, 12 GB+ phones) and
**Gemma 4 E2B** (8 GB phones) on them: SFT first, then DPO on judge-ranked student samples. It
then exports a **Q4_0 GGUF** and adds it to `models/manifest.json`. A LoRA bake-off against
**Qwen3.5-4B** on the first 5k dialogues confirms the base model before the full run. The
reasoning behind these choices is in the on-device models research (sections 1 and 3) and in
`docs/architecture.md` (Phase 5, "Model programme").

```
spec/        The tutor's behaviour contract, versioned (SPEC_VERSION 1.0.0):
             models.py (I/O models), schema/*.json (generated JSON Schemas),
             levels.py (CEFR bands and known-lemma ceilings), grammar_points.json (ids
             shared with packages/content), error_tags.json (42 tags mapped to grammar
             points), policy.py (prompt first, recast second, one error per turn),
             system_prompt.v1.txt + render.py (the exact prompt the model sees)
scenarios/   66 role-play scenarios, A1 to B2 (8 marked `split: eval`, never trained on)
data/        Seed lemma list (frequency ranks) and curated core vocabulary
datagen/     Teacher clients, simulated learner, dialogue synthesis, filters, judge,
             cost estimate, SFT/DPO dataset builders; configs/*.yaml
train/       SFT (LoRA via Unsloth or full via transformers + FSDP), DPO (TRL),
             candidate sampling; configs/*.yaml
eval/        Held-out metrics, judge win rates, markdown report, phone benchmark guide
export/      LoRA merge, llama.cpp GGUF conversion, imatrix, Q4_0, manifest, CPU smoke test
tests/       pytest for everything that does not need a GPU
```

## The tutor contract (spec/)

The input is the learner's level (with an optional known-lemma ceiling), their unlocked grammar
points, their recurring errors, and a scenario (roles, setting, goals, key vocabulary). From
these, `spec/render.py` builds a short system prompt. Keep the prompt short, because prefill
time is the phone's main latency cost. The output is one JSON object with `reply` first, so the
app can stream it to text-to-speech:

```json
{
  "reply": "Ho andato? Sei sicuro?",
  "annotations": {
    "prompt": { "learnerText": "ho andato", "errorTags": ["auxiliary-choice"] },
    "recast": null,
    "newWords": [],
    "scenarioProgress": { "goalsCompleted": ["where"], "done": false }
  }
}
```

The feedback policy has four rules:

- If the learner made no error, the tutor makes no correction.
- If the learner made an error, the tutor addresses only the most important one, with a prompt
  first.
- If the same error survives the prompt, the tutor gives a recast.
- A lexical error that blocks meaning gets a recast at once.

Replies stay inside the level band: the lemma ceiling, the scenario vocabulary, at most 1 or 2
declared new words, and the sentence length and count limits in `spec/levels.py`. Error tags map
to the content package's grammar point ids, so the app can turn conversation errors into reviews.

After changing the models, run `uv run python -m spec export-schema`. A test fails while the
committed schemas are stale. Bump `SPEC_VERSION` for any change to the output format or prompt.
llama.rn enforces `spec/schema/tutor_output.v1.schema.json` as a grammar on the phone. The app
must render the prompt from `spec/system_prompt.v1.txt` exactly as `render.py` does.

## Setup

```sh
cd training
uv sync                       # CPU tooling: spec, datagen, eval, export, tests
uv sync --extra gpu           # on the GPU machine: torch, transformers, TRL, PEFT, Unsloth
uv sync --extra export        # llama-cpp-python for the CPU smoke test (compiles llama.cpp)
uv run pytest && uv run ruff check . && uv run mypy .
```

The GPU stack is pinned to a set Unsloth declares compatible: torch 2.14.1, transformers 5.17.0,
TRL 1.15.0, PEFT 0.21.2, datasets 4.8.5, Unsloth 2026.11.4. `uv.lock` pins everything else.

You also need these services:

- **LanguageTool** (Italian grammar checks): `docker run -d -p 8010:8010 erikvl87/languagetool`,
  or set `LANGUAGETOOL_URL`.
- **Teacher and judge**: set the environment variables listed at the top of
  `datagen/configs/train.yaml` (`TEACHER_PROTOCOL`, `TEACHER_BASE_URL`, `TEACHER_MODEL`,
  `TEACHER_API_KEY`, `TEACHER_PRICE_IN`, `TEACHER_PRICE_OUT`, and optionally `JUDGE_*`). API keys
  are read from the environment only. Never write them into a config or commit them.
- **Hugging Face**: run `huggingface-cli login` and accept the Gemma licence on the model pages
  before downloading.

## Running each stage

All commands run from `training/`. Outputs go to `work/` (data) and `out/` (models). Both are
git-ignored.

**1. Pilot (about 300 dialogues).** This measures the real pass rate and cost per dialogue.

```sh
uv run python -m datagen estimate -c datagen/configs/pilot.yaml
uv run python -m datagen generate -c datagen/configs/pilot.yaml        # shows the cost, asks first
uv run python -m datagen filter   -c datagen/configs/pilot.yaml
uv run python -m datagen judge    -c datagen/configs/pilot.yaml
uv run python -m datagen stats    -c datagen/configs/pilot.yaml
```

Read the failure reasons that `filter` prints, and spot-check about 20 dialogues in
`work/datagen/pilot-v1/judged.jsonl` by hand. Then set `estimate.expectedPassRate` in `train.yaml`
from the pilot's numbers.

**2. Training data and the held-out set.** All stages are resumable: rerun a command after an
interruption and it skips finished work.

```sh
uv run python -m datagen generate -c datagen/configs/train.yaml
uv run python -m datagen filter   -c datagen/configs/train.yaml
uv run python -m datagen judge    -c datagen/configs/train.yaml
uv run python -m datagen build-sft -c datagen/configs/train.yaml --out work/sft
# the same generate / filter / judge for datagen/configs/eval.yaml, then:
uv run python -m eval build-items -c datagen/configs/eval.yaml --out work/eval/items.jsonl
```

Native speakers should spot-check 1 to 2% of the accepted dialogues before training. The research
recommends 2 raters for 200 turns per release.

**3. Base-model bake-off.** This trains LoRA on the same 5k-dialogue subset for each candidate,
then evaluates both.

```sh
uv run python -m train.sft -c train/configs/bakeoff-gemma4-e4b.yaml
uv run python -m train.sft -c train/configs/bakeoff-qwen35-4b.yaml
```

Merge each model and serve it (step 7), then compare the two with `python -m eval report`. Keep
Gemma 4 E4B unless Qwen3.5-4B wins clearly on the eval. Gemma also has better mobile kernels and
no thinking-mode overhead.

**4. SFT (release).**

```sh
uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \
  -m train.sft -c train/configs/sft-gemma4-e4b-full.yaml
# E2B: the same with sft-gemma4-e2b-full.yaml; LoRA alternatives: sft-*-lora.yaml
```

**5. Preference data and DPO.**

```sh
uv run python -m datagen build-dpo-prompts -c datagen/configs/train.yaml \
  --out work/dpo/prompts.jsonl --max-prompts 20000
uv run python -m train.sample --model out/sft-gemma4-e4b-full/final --loader image-text-to-text \
  --prompts work/dpo/prompts.jsonl --out work/dpo/candidates.jsonl -k 4
uv run python -m datagen judge-candidates -c datagen/configs/train.yaml --include-reference \
  --candidates work/dpo/candidates.jsonl --out work/dpo/scored.jsonl
uv run python -m datagen build-dpo --scored work/dpo/scored.jsonl --out work/dpo/pairs.jsonl
uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \
  -m train.dpo -c train/configs/dpo-gemma4-e4b.yaml
```

Pairs pit the best judged candidate against clearly worse ones: the margin must be at least 0.5,
and the chosen candidate must score at least 4.0. Invalid JSON always loses. Prompts come mostly
from turns that react to an error, plus some from correct learner turns, so DPO targets
prompt-versus-recast choices and over-correction. If the SFT model was LoRA, merge it first
(step 6) and point `policyModel` at the merged folder.

**6. Export.**

```sh
export/build_llama_cpp.sh                     # llama.cpp at the version llama.rn bundles (b11804)
uv run python -m export merge --model out/dpo-gemma4-e4b/final --out out/merged-e4b \
  --loader image-text-to-text                  # no-op for full fine-tunes
uv run python -m export calibration --sft work/sft/sft.train.jsonl --out work/calibration.txt
uv run python -m export gguf --model out/dpo-gemma4-e4b/final --id italia-tutor-e4b \
  --quant Q4_0 --imatrix work/calibration.txt   # also try --quant Q4_K_M / IQ4_XS for iOS
uv run python -m export smoke --gguf out/gguf/italia-tutor-e4b-q4_0-imat.gguf
```

The smoke test runs 3 tutor prompts on the CPU with the output schema enforced as a grammar. It
fails if any output is invalid, and it warns if the model's feedback move looks wrong.

**7. Evaluation.** Serve each model behind an OpenAI-compatible endpoint:

- the Q4_0 GGUF with `llama-server -m out/gguf/...gguf --port 8081 -c 8192`
- the bf16 checkpoint and the untuned base with `vllm serve`

Then run:

```sh
uv run python -m eval predict --items work/eval/items.jsonl --out work/eval/predictions.jsonl \
  --system student-q4 --system student-bf16 --system base --system teacher
uv run python -m eval report -c datagen/configs/eval.yaml --items work/eval/items.jsonl \
  --predictions work/eval/predictions.jsonl --system student-q4 --system student-bf16 \
  --system base --system teacher \
  --pairwise student-q4:teacher-reference --pairwise student-q4:base \
  --pairwise student-q4:student-bf16 --bench pixel9=bench-pixel9.json --out out/eval/report.md
```

The report covers:

- JSON validity
- LanguageTool errors per 100 words
- tokens outside the level band
- feedback-move accuracy, over-correction and under-correction
- recast correctness
- error-tag F1 against the injected errors
- annotation consistency
- position-swapped judge win rates against the teacher and the base model
- phone benchmarks; `eval/DEVICE_BENCH.md` explains how to run llama-bench on a phone

If the bf16-to-Q4_0 gap is more than 2 to 3 rubric points, try the imatrix variants, or add a
short QAT phase.

## Runbook A: rented GPU (RunPod, Lambda, or similar)

These estimates use the research's figures at about US$2 to 4 per H100-hour. They are judgement,
not measurements; the pilot and the first runs will replace them.

| Stage | GPU | VRAM | Time | Compute cost |
|---|---|---|---|---|
| Bake-off: 2 LoRA runs on 5k dialogues | 1x H100 80 GB | ~17 GB (E4B LoRA) | ~1 to 1.5 h each | ~$5 to 12 |
| LoRA SFT on the full 40k (ablations) | 1x A100/H100 80 GB | 10 to 17 GB | 4 to 8 h | ~$10 to 30 |
| Full SFT, E4B (release) | 8x H100 80 GB, FSDP | ~60 GB per GPU | 6 to 12 h | ~$150 to 400 |
| Full SFT, E2B | 8x H100 (or 4x) | about half | 3 to 6 h | ~$75 to 200 |
| Candidate sampling (20k prompts x 4) | 1x H100 | ~20 GB | 3 to 5 h (about 1 h with vLLM) | ~$10 to 20 |
| DPO, E4B / E2B | 8x H100 | as SFT plus a reference copy | 20 to 30% of SFT | ~$30 to 120 / $15 to 60 |
| Export (convert, imatrix, quantise) and serving for eval | 1x any 24 GB+ GPU | 16 GB | ~1 to 2 h | ~$3 to 8 |

The total compute for both E4B and E2B is **about US$300 to 850**. The **teacher API bill
dominates**. `python -m datagen estimate` prints it from your prices before anything is spent.
At an example price of $3 / $15 per million input / output tokens, the full train config (57k
jobs with the revise pass, expected to keep about 40k dialogues) comes to:

| Stage | Input tokens | Output tokens | Cost |
|---|---|---|---|
| Generate | 152M | 62M | ~$1,380 |
| Revise | 240M | 62M | ~$1,650 |
| Judge | 124M | 14M | ~$580 |
| **Total** | | | **~$3,600** |

On top of that, candidate judging for DPO costs about $300 to 400 and the evaluation set about
$50. Three things reduce the bill:

- Prompt caching at the provider, because every brief repeats the same instructions and schema.
- `revisePass: false` saves about 45%, at some cost to quality; measure it on the pilot.
- A cheaper judge (`JUDGE_*`).

Steps for a rented GPU:

1. Rent an 8x H100 80 GB pod with CUDA 12.8+ and at least 500 GB of disk for checkpoints. Use a
   single H100 for the bake-off and LoRA runs.
2. Run `git clone` with this repository, then `cd training`. Install uv
   (`curl -LsSf https://astral.sh/uv/install.sh | sh`), then run `uv sync --extra gpu`.
3. Run `huggingface-cli login`. Copy `work/sft/`, `work/dpo/` and `work/eval/` up with `rsync`.
   Data generation needs no GPU, so run it on any machine.
4. Run steps 3 to 6 above inside `tmux`. The Trainer saves checkpoints every `saveSteps`; resume
   with the same command after a pre-emption.
5. Copy `out/gguf/*.gguf` and `out/eval/` back. Stop the pod.

## Runbook B: local NVIDIA GPU

- **24 GB (RTX 3090 or 4090):**
  - SFT: LoRA for both E4B and E2B (`sft-gemma4-e4b-lora.yaml`, `sft-gemma4-e2b-lora.yaml`).
    Full fine-tuning does not fit.
  - DPO: `dpo-gemma4-e4b-lora.yaml`, starting from the merged SFT model.
  - Expected time is about 2 to 3 times the H100 figures: E4B LoRA on 40k dialogues takes about
    12 to 24 h, and E2B about half that.
- **16 GB:** E2B LoRA only. Set `loadIn4bit: true` (QLoRA) in a copy of the config for E4B.
- Steps:
  1. Install the NVIDIA driver (CUDA 12.8+ runtime).
  2. Run `uv sync --extra gpu`.
  3. Run `CUDA=1 export/build_llama_cpp.sh`.
  4. Run steps 3 to 6 with `--config_file train/configs/accelerate-1gpu.yaml`, or with plain
     `uv run python -m train.sft -c ...`.
- Electricity at about 450 W for about 20 h is roughly 9 kWh. Use LoRA r 128 for the release
  model if full fine-tuning is out of reach.

## Putting the model in the app

1. Upload the GGUF to stable HTTPS storage, for example a private Hugging Face repository or an
   object-storage bucket. **Never commit weights.**
2. Record it in the manifest:
   `uv run python -m export manifest --gguf out/gguf/italia-tutor-e4b-q4_0-imat.gguf --id
   italia-tutor-e4b-q4_0 --url https://.../italia-tutor-e4b-q4_0.gguf --licence Apache-2.0
   --write`.
   This computes the sha256 and size, upserts the entry, and validates `models/manifest.json`
   against its schema. Run `pnpm check` at the repository root, then commit.
3. The app's model download manager (the Phase 5 runtime workstream) downloads the file on
   Wi-Fi, verifies the sha256, and loads it with `llama.rn`. Use these settings:
   - Q4_0 for the OpenCL path
   - `n_ctx` 4096
   - `kv_unified: true` and `flash_attn_type: 'off'` when OpenCL and session save are both used
   - the response format set to `spec/schema/tutor_output.v1.schema.json`, so output is
     grammar-constrained
4. The `ConversationPartner` implementation renders the system prompt from the same template
   and data as `spec/render.py`. It sends `[inizio]` as the first user message, and keeps
   earlier tutor turns as their JSON. It reuses the KV cache of the system prompt between turns.
5. Phones with 12 GB of RAM or more get E4B, and 8 GB phones get E2B. Phones with less get no
   tutor.

## Known gaps

- The GPU stages (`train/`, `export merge`, `train.sample`) have not been run on a GPU yet. Their
  pure logic is unit-tested, and their calls were checked against the pinned library sources.
  The first bake-off run is the integration test.
- The seed lemma list (`data/lemmas.seed-v1.tsv`) comes from subtitle frequencies. It ranks
  basic course vocabulary (days of the week, food, places) low and lacks some lemmas entirely
  (for example "grande"). `data/core_vocab.tsv` patches this for band checks. The content
  pipeline should fix it at the source.
- No error-annotated Italian learner corpus exists, so the gold labels are the injected errors.
  Native-speaker spot checks remain essential.
