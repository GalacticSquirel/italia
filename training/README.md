# training: the on-device tutor model programme

This folder builds the Italian conversation tutor that runs on the phone through `llama.rn`. It is
a Python 3.12 project managed with [uv](https://docs.astral.sh/uv/). It is separate from the
pnpm workspace, and Prettier and ESLint ignore it.

The pipeline is **sequence-level distillation**. A large open-weight or hosted teacher model
writes level-controlled tutoring dialogues with injected learner errors, prompt-then-recast
feedback and structured annotations. The pipeline filters and judges them, then fine-tunes
**Gemma 4 E4B** (primary, 12 GB+ phones) and **Gemma 4 E2B** (8 GB phones): SFT first, then DPO on
judge-ranked student samples. It exports a **Q4_0 GGUF** and adds it to `models/manifest.json`. A
LoRA bake-off against **Qwen3.5-4B** on the first 5k dialogues confirms the base model. The
reasoning is in the on-device models research (sections 1 and 3) and in `docs/architecture.md`
(Phase 5, "Model programme").

**The primary path runs on one Mac Studio (Apple Silicon) with no CUDA:** an open-weight teacher
served locally by `mlx_lm.server`, training with MLX (LoRA, DoRA or full fine-tuning; DPO), and
GGUF export with a Metal build of llama.cpp. The NVIDIA path (Unsloth/transformers + TRL) stays
available for a rented or local GPU. Both use the same data, loss masks and export.

```
spec/        The tutor's behaviour contract, versioned (SPEC_VERSION 1.0.0):
             models.py (I/O models), schema/*.json (generated JSON Schemas),
             levels.py (CEFR bands and known-lemma ceilings), grammar_points.json (ids
             shared with packages/content), error_tags.json (42 tags mapped to grammar
             points), policy.py (prompt first, recast second, one error per turn),
             system_prompt.v1.txt + render.py (the exact prompt the model sees)
scenarios/   91 role-play scenarios, A1 to C2 (11 marked `split: eval`, never trained on)
data/        Seed lemma list (frequency ranks) and curated core vocabulary
datagen/     Teacher clients (any OpenAI- or Anthropic-compatible endpoint, including a local
             mlx-lm server), simulated learner, synthesis, filters, judge, cost and time
             estimate, throughput bench, SFT/DPO dataset builders; configs/*.yaml
train/       Backends: mlx (Apple Silicon: mlx_core.py, mlx_sft.py, mlx_dpo.py) and NVIDIA
             (sft.py via Unsloth or transformers + FSDP, dpo.py via TRL); shared tokenisation
             and masks (tokenize.py), schedules and checkpoints (schedule.py), MLX lineage
             (lineage.py), memory planner (memory.py), candidate sampling (sample.py);
             configs/*.yaml (NVIDIA) and configs/mlx/*.yaml (Mac)
eval/        Held-out metrics, judge win rates, markdown report, phone benchmark guide
export/      MLX fuse + Hugging Face re-layout (splice.py), PEFT merge, llama.cpp GGUF
             conversion, imatrix, Q4_0, manifest, CPU smoke test
tests/       pytest for everything that does not need a GPU; MLX code runs on MLX's CPU backend
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

After changing the spec (models, prompt, levels, tags or scenarios), run
`uv run python -m spec export-schema`. It writes every generated file, including the app's copy of
the spec in `packages/core/src/tutor/spec.generated.ts`, and a test fails while any is stale. Bump `SPEC_VERSION` for any change to the output format or prompt.
llama.rn enforces `spec/schema/tutor_output.v1.schema.json` as a grammar on the phone. The app
must render the prompt from `spec/system_prompt.v1.txt` exactly as `render.py` does.

## Setup

```sh
cd training
uv sync                       # CPU tooling and tests (includes MLX: Metal on macOS, CPU on Linux)
uv sync --extra mlx           # Mac Studio: MLX + mlx-lm for training and the local teacher
uv sync --extra gpu           # NVIDIA machine instead: torch, transformers, TRL, PEFT, Unsloth
uv sync --extra export        # llama-cpp-python for the CPU smoke test (compiles llama.cpp)
uv run pytest && uv run ruff check . && uv run mypy .
```

Pins: MLX 0.32.4 and mlx-lm 0.32.2 for the Mac path. The NVIDIA stack is pinned to a set Unsloth
declares compatible: torch 2.14.1, transformers 5.17.0, TRL 1.15.0, PEFT 0.21.2, datasets 4.8.5,
Unsloth 2026.11.4. `uv.lock` pins everything else.

You also need these services:

- **LanguageTool** (Italian grammar checks): `docker run -d -p 8010:8010 erikvl87/languagetool`
  (Docker Desktop or colima on macOS), or point `LANGUAGETOOL_URL` at another server. Without
  Docker, the standalone Java server works too: `brew install languagetool`, then
  `languagetool-server --port 8010`.
- **Teacher and judge**, either:
  - **local (Mac default):** `datagen/configs/local-mac.yaml`, served by `mlx_lm.server` on
    the same machine. No API key and no per-token cost. See "Local teacher" below.
  - **hosted API:** set the environment variables listed at the top of
    `datagen/configs/train.yaml` (`TEACHER_PROTOCOL`, `TEACHER_BASE_URL`, `TEACHER_MODEL`,
    `TEACHER_API_KEY`, `TEACHER_PRICE_IN`, `TEACHER_PRICE_OUT`, and optionally `JUDGE_*`). API
    keys are read from the environment only. Never write them into a config or commit them.
- **Hugging Face**: run `uv run huggingface-cli login` and accept the Gemma licence on the
  model pages before downloading.

## Local teacher on the Mac (no API cost)

`mlx_lm.server` exposes an OpenAI-compatible endpoint with continuous batching, so the existing
`openai` client is the teacher and judge. Pick the strongest instruct model that fits beside the
OS (training does not run at the same time as generation). Start it with
`scripts/serve-teacher.sh` or `python -m datagen.serve_teacher`, which take the same flags as
`mlx_lm.server` but first fix mlx-lm's leak of Metal buffers in batched decode on hybrid models
such as Qwen3-Next and Qwen3.5 (without it the server dies every few minutes with
`[metal::malloc] Resource limit (499000) exceeded`; see `datagen/mlx_compat.py`):

| Unified memory | Recommended teacher (MLX 4-bit) | Weights | Alternative |
|---|---|---|---|
| 64 GB | `mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit` | 45 GB | `Llama-3.3-70B-Instruct-4bit` (40 GB, dense: ~3x slower) |
| 96 GB | `mlx-community/Qwen3.5-122B-A10B-4bit` (concurrency 4) | 70 GB | `GLM-4.5-Air-4bit` (60 GB) |
| 128 GB | `mlx-community/Qwen3.5-122B-A10B-4bit` (**default**) | 70 GB | `GLM-4.5-Air-4bit` (60 GB) |
| 192 GB | `mlx-community/Qwen3-235B-A22B-Instruct-2507-4bit` | 132 GB | Qwen3.5-122B for 2.3x the speed |
| 256 GB | `Qwen3-235B-A22B-Instruct-2507-4bit` (room for 16 in flight) | 132 GB | `GLM-4.7-4bit` (199 GB, tight) |
| 512 GB | `mlx-community/Qwen3.5-397B-A17B-4bit` | 224 GB | `DeepSeek-V3.2-4bit` (378 GB, ~2x slower), `Qwen3-235B-…-8bit` (250 GB) |

Weight sizes are the safetensors totals of those Hugging Face repositories. Leave 15 to 25% of RAM
for the KV cache of the requests in flight and for macOS. Above about 75% of RAM, raise the GPU
wired limit: `sudo sysctl iogpu.wired_limit_mb=<RAM in MB minus 8192>` (resets on reboot).

**64 GB.** The 80B-A3B teacher (45 GB) leaves little room for KV caches, so serve it with
decode concurrency 8, prompt concurrency 2 and a 2 GiB prompt cache, which
`scripts/serve-teacher.sh` picks by default on a 64 GB Mac. Raising the wired limit is optional
but avoids swapping under load: `sudo sysctl iogpu.wired_limit_mb=57344`.

**Throughput and wall-clock time.** The 57k-job config needs about 517M prompt and 137M generated
tokens (generate + revise + judge); without the revise pass, 277M and 76M. Prefill dominates, so
batching helps less than for chat. The table uses planning throughputs (aggregate prompt/decode
tokens per second at 8 requests in flight on an M3 Ultra), derived from single-stream
measurements: Qwen3-235B-A22B 4-bit decodes at ~24 tok/s with MLX and prefills a 9.3k-token
prompt at ~164 tok/s; Qwen3.5-122B-A10B 4-bit decodes at ~57 tok/s. Decode is assumed to scale
2.5 to 3x with batching and prefill not at all.

| Teacher | Planning tok/s (prompt / decode) | 10k jobs | 10k, no revise | 57k jobs | 57k, no revise |
|---|---|---|---|---|---|
| Qwen3-Next-80B-A3B | 800 / 250 | ~2.4 days | ~1.3 days | ~14 days | ~7.5 days |
| Qwen3.5-122B-A10B | 400 / 150 | ~4.4 days | ~2.4 days | ~26 days | ~14 days |
| Qwen3.5-397B-A17B | 220 / 70 | ~8.6 days | ~4.7 days | ~50 days | ~27 days |
| Qwen3-235B-A22B | 180 / 60 | ~10 days | ~5.6 days | ~60 days | ~32 days |

Measure your machine instead of trusting the table, then let the estimator do the arithmetic:

```sh
uv run --extra mlx python -m datagen.serve_teacher --model mlx-community/Qwen3.5-122B-A10B-4bit \
  --port 8080 --decode-concurrency 8 --prompt-concurrency 4 &
uv run python -m datagen bench -c datagen/configs/local-mac.yaml    # prints a throughput block
export LOCAL_PROMPT_TPS=... LOCAL_GEN_TPS=...                        # or paste it into the config
uv run python -m datagen estimate -c datagen/configs/local-mac.yaml  # $0 API, hours per stage
```

**Recommendation:** run a **10k-job first round** (keeps ~7k dialogues; the default of
`local-mac.yaml`), train and evaluate on it, and only then decide on the full 57k. The job list is
prefix-stable: `TARGET_DIALOGUES=57000` with the same config resumes in the same folder and only
generates the remaining jobs. If the full round would take weeks, use a hosted API for the
remainder (same pipeline, `train.yaml`) or turn off the revise pass (`REVISE=false`, about 45%
faster, measured on the pilot first). Local teachers are weaker than the best hosted models in
Italian, so the filters, judge threshold and native-speaker spot checks matter more.

Sources for sizes and speeds:
[Qwen3-235B-A22B-Instruct-2507-4bit](https://huggingface.co/mlx-community/Qwen3-235B-A22B-Instruct-2507-4bit),
[Qwen3.5-122B-A10B-4bit](https://huggingface.co/mlx-community/Qwen3.5-122B-A10B-4bit),
[Qwen3.5-397B-A17B-4bit](https://huggingface.co/mlx-community/Qwen3.5-397B-A17B-4bit),
[Qwen3-Next-80B-A3B-Instruct-4bit](https://huggingface.co/mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit),
[GLM-4.5-Air-4bit](https://huggingface.co/mlx-community/GLM-4.5-Air-4bit),
[GLM-4.7-4bit](https://huggingface.co/mlx-community/GLM-4.7-4bit),
[DeepSeek-V3.2-4bit](https://huggingface.co/mlx-community/DeepSeek-V3.2-4bit),
[Llama-3.3-70B-Instruct-4bit](https://huggingface.co/mlx-community/Llama-3.3-70B-Instruct-4bit);
MacStories, [early Mac Studio benchmarks with Qwen3-235B-A22B](https://www.macstories.net/notes/notes-on-early-mac-studio-ai-benchmarks-with-qwen3-235b-a22b-and-qwen2-5-vl-72b/)
(MLX 24 tok/s, ~124 GB); r/LocalLLaMA,
[M3 Ultra binned vs unbinned MLX benchmarks](https://www.reddit.com/r/LocalLLaMA/comments/1kzq4fp/m3_ultra_binned_256gb_60core_vs_unbinned_512gb/)
(Qwen3-235B-A22B 4-bit: 9,318-token prompt at 164 tok/s, generation 20 tok/s, 135 GB peak);
[SiliconScore, Qwen3.5-122B-A10B on M3 Ultra](https://siliconscore.com/models/qwen3-5-122b-a10b/)
(MLX 4-bit 57 tok/s); [MLX discussion #3209](https://github.com/ml-explore/mlx/discussions/3209)
(M3 Ultra 512 GB: 32B dense 4-bit at ~31 tok/s and ~345 tok/s prefill at 1k context; all
measurements at batch 1).

## Running each stage (Mac Studio)

All commands run from `training/`. Outputs go to `work/` (data) and `out/` (models), both
git-ignored. Every stage is resumable: rerun the same command after an interruption. The NVIDIA
equivalents are in "Runbook B" and "Runbook C".

**0. Serve the teacher** (keep it running in its own tmux window during stages 1, 2 and 5):

```sh
scripts/serve-teacher.sh "$LOCAL_TEACHER_MODEL"   # sizes the server for this Mac's memory
```

Keep machine-specific exports (`LOCAL_TEACHER_MODEL`, `LOCAL_PROMPT_TPS`, `LOCAL_GEN_TPS`, ...)
in an untracked `training/<name>.local.sh` (git-ignored); both scripts source every
`training/*.local.sh`.

**1. Pilot (300 jobs).** Measures the real pass rate and time per dialogue. The local config's
job list is prefix-stable, so the pilot's dialogues count towards round 1.

```sh
export TARGET_DIALOGUES=300
uv run python -m datagen estimate -c datagen/configs/local-mac.yaml
uv run python -m datagen generate -c datagen/configs/local-mac.yaml   # shows $0 + hours, asks first
uv run python -m datagen filter   -c datagen/configs/local-mac.yaml
uv run python -m datagen judge    -c datagen/configs/local-mac.yaml
uv run python -m datagen stats    -c datagen/configs/local-mac.yaml
```

Read the failure reasons that `filter` prints, and spot-check about 20 dialogues in
`work/datagen/local-v1/judged.jsonl` by hand. Then set `estimate.expectedPassRate` from the
pilot's numbers.

**2. Round-1 training data (10k jobs) and the held-out set.** `scripts/run-round.sh <config>
<n>` runs generate (without asking), refilter, judge and stats for `n` jobs and resumes after an
interruption; set `SFT_OUT=work/sft` to also build the SFT files. By hand:

```sh
export TARGET_DIALOGUES=10000
uv run python -m datagen generate -c datagen/configs/local-mac.yaml --yes
uv run python -m datagen filter   -c datagen/configs/local-mac.yaml
uv run python -m datagen judge    -c datagen/configs/local-mac.yaml
uv run python -m datagen build-sft -c datagen/configs/local-mac.yaml --out work/sft
# the same generate / filter / judge for datagen/configs/eval-local.yaml, then:
uv run python -m eval build-items -c datagen/configs/eval-local.yaml --out work/eval/items.jsonl
```

Native speakers should spot-check 1 to 2% of the accepted dialogues before training. The research
recommends 2 raters for 200 turns per release. Stop the teacher server before training to free
its memory.

**3. Base-model bake-off** (LoRA on the same 5k dialogues for each candidate):

```sh
uv run python -m train.sft -c train/configs/mlx/bakeoff-gemma4-e4b.yaml
uv run python -m train.sft -c train/configs/mlx/bakeoff-qwen35-4b.yaml
```

Export and serve each (steps 6 and 7), then compare them with `python -m eval report`. Keep
Gemma 4 E4B unless Qwen3.5-4B wins clearly; Gemma also has better mobile kernels and no
thinking-mode overhead.

**4. SFT (release).** LoRA works on every tier; full fine-tuning needs 96 GB+ for E4B
(`python -m train.memory` prints the plan for every model and RAM tier).

```sh
uv run python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml
uv run python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-full.yaml    # 96 GB+
# E2B: sft-gemma4-e2b-*.yaml. Tune for your RAM without editing files:
uv run python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
  --set optim.perDeviceBatchSize=4 --set optim.gradientAccumulationSteps=4
```

The MLX trainer puts loss on every tutor turn (the same masks as the NVIDIA path), uses gradient
checkpointing and gradient accumulation, and writes `out/mlx/<run>/final/` with only the trained
delta (`weights.safetensors`, adapters or the trained weights) and `italia-train.json`, which
names the base model. Nothing is merged until export.

**5. Preference data and DPO.**

```sh
uv run python -m datagen build-dpo-prompts -c datagen/configs/local-mac.yaml \
  --out work/dpo/prompts.jsonl --max-prompts 5000        # 20000 for the full round
uv run python -m train.sample --backend mlx --model out/mlx/sft-gemma4-e4b-lora/final \
  --prompts work/dpo/prompts.jsonl --out work/dpo/candidates.jsonl -k 4
# restart the teacher server (it is also the judge), then:
uv run python -m datagen judge-candidates -c datagen/configs/local-mac.yaml --include-reference \
  --candidates work/dpo/candidates.jsonl --out work/dpo/scored.jsonl
uv run python -m datagen build-dpo --scored work/dpo/scored.jsonl --out work/dpo/pairs.jsonl
# stop the server again, then:
uv run python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml
#   after a full SFT run: --set policyModel=out/mlx/sft-gemma4-e4b-full/final
```

DPO on MLX is implemented in `train/mlx_dpo.py` rather than with a third-party MLX trainer: our
prompts are multi-turn (earlier tutor turns are context, not targets), an optional NLL term on the
chosen answer guards against drift (`sftLossWeight`), and the masks must match SFT. The reference
log-probabilities come from the SFT model once, before training, and are cached in
`reference_logps.json`, so only one model is ever in memory. Pairs pit the best judged candidate
against clearly worse ones (margin at least 0.5, chosen at least 4.0; invalid JSON always loses).

**6. Export: MLX -> Hugging Face safetensors -> GGUF.**

```sh
export/build_llama_cpp.sh       # Metal build of llama.cpp at the llama.rn version (b11804)
uv run python -m export mlx-fuse --model out/mlx/dpo-gemma4-e4b/final --out out/merged/e4b
uv run python -m export calibration --sft work/sft/sft.train.jsonl --out work/calibration.txt
uv run python -m export gguf --model out/merged/e4b --id italia-tutor-e4b \
  --quant Q4_0 --imatrix work/calibration.txt   # also try --quant Q4_K_M / IQ4_XS for iOS
uv run python -m export smoke --gguf out/gguf/italia-tutor-e4b-q4_0-imat.gguf
uv run python -m export manifest --gguf out/gguf/italia-tutor-e4b-q4_0-imat.gguf \
  --id italia-tutor-e4b-q4_0 --url https://.../italia-tutor-e4b-q4_0.gguf   # prints sha256
```

`mlx-fuse` rebuilds the model from its lineage (base, then the SFT delta, then the DPO delta,
fusing each LoRA), then writes a Hugging Face checkpoint. It does not save MLX's own layout:
it copies the original checkpoint (config, tokenizer, processor files, vision and audio towers)
and swaps in the fine-tuned language-model tensors under their original names, dtypes and
layouts (Qwen3.5's MLX loader stores RMSNorm weights as 1 + w and transposes conv1d kernels; the
splice undoes both). llama.cpp's `convert_hf_to_gguf.py` therefore sees exactly the files it
expects. The smoke test runs 3 tutor prompts on the CPU with the output schema enforced as a
grammar; it fails on any invalid output and warns if the feedback move looks wrong.

**7. Evaluation.** Serve each system behind an OpenAI-compatible endpoint. On the Mac:

- the Q4_0 GGUF, exactly as the phone runs it, with schema-constrained decoding:
  `work/llama.cpp/build/bin/llama-server -m out/gguf/...gguf --port 8081 -c 8192`
- the bf16 export and the untuned base with mlx-lm:
  `uv run --extra mlx mlx_lm.server --model out/merged/e4b --port 8082` and
  `... --model google/gemma-4-E4B-it --port 8083` (mlx-lm does not constrain JSON, so their
  JSON-validity rows measure the unconstrained model)
- the local teacher on port 8080, with `TEACHER_BASE_URL=http://127.0.0.1:8080/v1`,
  `TEACHER_MODEL=$LOCAL_TEACHER_MODEL` and `TEACHER_API_KEY=local` (the server ignores it)

On an NVIDIA box, serve the bf16 checkpoints with `vllm serve` instead. Then run:

```sh
uv run python -m eval predict --items work/eval/items.jsonl --out work/eval/predictions.jsonl \
  --system student-q4 --system student-bf16 --system base --system teacher
uv run python -m eval report -c datagen/configs/eval-local.yaml --items work/eval/items.jsonl \
  --predictions work/eval/predictions.jsonl --system student-q4 --system student-bf16 \
  --system base --system teacher \
  --pairwise student-q4:teacher-reference --pairwise student-q4:base \
  --pairwise student-q4:student-bf16 --bench pixel9=bench-pixel9.json --out out/eval/report.md
```

The report covers:

- a parity table: each system against the reference turns on the headline metrics below, with
  a tolerance per metric, and the judge win rate against the reference (on par at 45% or more)
- JSON validity
- LanguageTool errors per 100 words
- tokens outside the level band
- feedback-move accuracy, over-correction and under-correction
- correction accuracy (a due correction made, on the right error; word-choice and false-friend
  count as one kind of error here and in recast correctness, while tag F1 keeps them apart)
- prompts that give the answer away (the reply contains the gold correction)
- recast correctness (the recast makes the gold correction on the right tag, whatever its span
  length or grammatical person; rewording around the error does not count)
- error-tag F1 against the injected errors
- annotation consistency
- position-swapped judge win rates against the teacher and the base model
- phone benchmarks; `eval/DEVICE_BENCH.md` explains how to run llama-bench on a phone

If the bf16-to-Q4_0 gap is more than 2 to 3 rubric points, try the imatrix variants, or add a
short QAT phase.

**The parity benchmark.** The items above come from the local teacher's eval-split dialogues, so
their reference is only as good as that teacher. `data/bench/` holds a hand-written benchmark at
the level of the best hosted tutors: dialogues on evaluation-only scenarios at every level from
A1 to C2, each corrected learner turn with its gold wrong span and correction, and every tutor turn
written as the best move under the policy. Use it as the yardstick for "as good as a cloud tutor":

```sh
uv run python -m datagen.handwritten build --bench --all     # needs LanguageTool on :8010
uv run python -m eval build-items --records 'data/bench/*.jsonl' --out work/eval/bench.jsonl
uv run python -m eval predict --items work/eval/bench.jsonl --out work/eval/bench-pred.jsonl \
  --system student-q4 --system base
uv run python -m eval report -c datagen/configs/eval-local.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-pred.jsonl --system student-q4 --system base \
  --pairwise student-q4:teacher-reference --title "Parity benchmark" --out out/eval/bench.md
```

Here `teacher-reference` is the benchmark's own tutor turns. The model reaches parity when every
row of the parity table is on par.

**The real-learner check.** Every benchmark learner turn above was written by a model imitating a
learner. `data/learner/merlin-it.jsonl` holds sentences that real learners wrote in CEFR exams
(MERLIN, A1 to B2), each with a native speaker's minimal correction; see `data/learner/README.md`.
A fifth of the authors are held out (`split: eval`). Their sentences become single-turn items in
the eval-only `raccontare-novita` scenario, in which the learner catches up with a friend (letter
formulas, all-capitals sentences and fragments are left out):

```sh
uv run python -m datagen merlin          # downloads the pinned release to work/, writes the pairs
uv run python -m eval learner-items --out work/eval/learner.jsonl
uv run python -m eval predict --items work/eval/learner.jsonl \
  --out work/eval/learner-pred.jsonl --system student-q4
uv run python -m eval learner-report --items work/eval/learner.jsonl \
  --predictions work/eval/learner-pred.jsonl --system student-q4 --out out/eval/learner.md
```

The report gives the share of natively corrected sentences where the tutor corrects something
(errors detected), the share of sentences the native corrector left alone where it corrects
something anyway (false flags), and how many of its recasts copy a span of the learner's sentence
and correct it to a span of the native correction. Minimal native corrections leave a few errors
in place (a blind check found at least 4 in 50 "unchanged" sentences), so a few per cent of false
flags is the floor.

**As shipped.** Both reports score the model's raw output. Before the app shows a turn, it drops
corrections it cannot trust (`postValidate` in `packages/core/src/tutor/validate.ts`): a quoted span
the learner never wrote, a recast that changes nothing or rewrites far more than its span, a turn
with both a prompt and a recast. Add `--as-shipped` to `eval report` or `eval learner-report` to
apply the same checks (`eval/shipped.py`) first and score what learners actually see.

## How generation and filtering handle teacher slips

**Repair turn.** When a draft cannot be parsed or validated, the specific problems (with their
JSON locations, such as `turns[4].output.annotations.recast`) go back to the teacher in the same
conversation, which returns the corrected full JSON. `repairAttempts` (default 1) bounds the
extra calls; only then does the attempt count as failed. The failed attempt's last output is
kept in `failed.jsonl`, so a later parser can recover it (`refilter --reparse-failed`).

**Invalid annotation items are dropped, not the dialogue.** A recast whose correctedText equals
its learnerText, unknown error tags (a prompt or recast left with none), malformed or surplus
newWords items and unknown goal ids are removed and noted in the record's `parseNotes`. The
policy filter still checks the remaining moves against the plan.

**Turn-count tolerance.** The plan fixes the number of learner turns. One learner exchange more
or fewer is accepted only when the final tutor turn marks the scenario done and every turn is
otherwise valid. With one fewer, the plan's last step is dropped; with one more, the extra
exchange is planned as an error-free learner turn with no correction. Anything else is a problem
for the repair turn.

**Band check.** Tokens the tutor echoes from the learner (the previous learner turn, a prompt's
or recast's learnerText) are not checked, so quoting "andarò?" back is not out of band. Elided
forms are restored (qualcos'altro, vent'anni, qualcos' altro), -mente adverbs count as their
adjective (correttamente -> corretto), absolute superlatives as their base (benissimo -> bene),
and `data/cognates.txt` lists transparent cognates known from A1 (italiano, problema). Each
scenario's key vocabulary and declared new words are always allowed.

**Prompts must not reveal the correction.** The filter rejects a prompt whose reply contains the
correction that follows it (the next recast's correctedText, or a corrected token from the
learner's successful repair, such as "piccola" after "cucina piccolo"), and the judge scores
`promptWithholds`. The writer instructions also carry counterexamples for c'è / ci sono
agreement and for the preposition before an interrogative or relative pronoun ("A quale fermata
deve scendere?").

**Refilter after a filter change.** `datagen refilter -c <config>` re-runs the filters and dedupe
over `raw.jsonl` without calling the teacher, prints the pass count before and after, and drops
judged rows whose dialogue no longer passes; `judge` then scores only the new passes.
`--reparse-failed` first reparses failed jobs' kept outputs with the current parser. Rows that
failed before outputs were kept have no text and are simply retried by `generate` (up to
`maxAttempts`).

Fixtures from round 1: `tests/fixtures/band_rejections.jsonl` (16 out-of-band rejections that
were false positives: 2 passed before these changes, 16 now) and `tests/fixtures/parse_drafts.jsonl`
(21 first drafts: 3 parsed before, 15 now; the other 6 are off by more than the tolerance or not
done and go to the repair turn).

## Runbook A: Mac Studio over ssh (primary)

Designed for an M2/M3 Ultra-class Mac Studio with 64 to 512 GB of unified memory, reached over
ssh. Find out what you have first: `sysctl -n machdep.cpu.brand_string hw.memsize`.

**Prepare the Mac (once).**

1. macOS 15 or later. Install the command line tools (`xcode-select --install`), Homebrew, and
   `brew install tmux cmake jq macmon`. Install uv:
   `curl -LsSf https://astral.sh/uv/install.sh | sh`. uv downloads Python 3.12 itself.
2. Stop the Mac sleeping during multi-day runs: `sudo pmset -a sleep 0 disksleep 0`, or prefix
   long commands with `caffeinate -dimsu`. Keep it on Ethernet and mains power.
3. `git clone` this repository, `cd italia/training`, `uv sync --extra mlx`, and
   `uv run huggingface-cli login`. If the internal disk is small, put the Hugging Face cache on a
   fast external SSD: `export HF_HOME=/Volumes/<ssd>/hf` in `~/.zshrc`.
4. Start LanguageTool (see Setup) and build llama.cpp: `export/build_llama_cpp.sh`.
5. Check the toolchain: `uv run pytest` (runs the MLX tests on the GPU here).

**Long runs.** Everything runs inside tmux so an ssh drop does not kill it:

```sh
ssh mac-studio
tmux new -s italia                    # later: tmux attach -t italia; detach with Ctrl-b d
cd ~/italia/training
caffeinate -dimsu uv run python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
  2>&1 | tee -a out/logs-sft-e4b.txt
```

Use one tmux window for the teacher server and one per stage. Without tmux,
`nohup caffeinate -dimsu uv run python -m ... > out/logs-<stage>.txt 2>&1 &` works too.

**Resume.** Rerun the same command. Data generation skips finished jobs; judging skips judged
dialogues; training reloads the newest complete checkpoint in `<outputDir>/checkpoints/`
(weights, optimizer moments and the step) and continues with exactly the batches and learning
rate it would have had. A checkpoint written by a different config is refused; use a new
`outputDir` or `--no-resume`. Checkpoints are written every `saveSteps` optimizer steps and the
newest `mlx.keepCheckpoints` are kept.

**Monitoring.**

- training: `tail -f out/mlx/<run>/metrics.jsonl | jq -c '{step, loss, tokens_per_s,
  peak_memory_gb, eta_h}'`; validation rows carry `val_loss` (and DPO reward accuracy)
- data generation: `uv run python -m datagen stats -c datagen/configs/local-mac.yaml`
- the machine: `sudo macmon` (GPU, power, memory) or Activity Monitor's memory pressure. Swap
  use means the micro-batch is too big: stop, lower `optim.perDeviceBatchSize`, raise
  `optim.gradientAccumulationSteps` to keep 16 sequences per step, and resume with a new
  `outputDir` (the config digest changes).

**Memory per tier.** `uv run python -m train.memory` prints the plan; approximate peaks at
4,096 tokens with gradient checkpointing and the default wired limit (~75% of RAM):

| SFT model / method | 64 GB | 96 GB | 128 GB | 192 GB | 256 GB | 512 GB |
|---|---|---|---|---|---|---|
| gemma4-e4b lora | bs 2 x8 (~46 GB) | bs 2 x8 (~46 GB) | bs 4 x4 (~73 GB) | bs 8 x2 (~127 GB) | bs 8 x2 (~127 GB) | bs 8 x2 (~127 GB) |
| gemma4-e4b full | no (~58 GB at bs 1) | bs 2 x8 (~72 GB) | bs 2 x8 (~72 GB) | bs 4 x4 (~98 GB) | bs 8 x2 (~152 GB) | bs 8 x2 (~152 GB) |
| gemma4-e2b lora | bs 2 x8 (~38 GB) | bs 4 x4 (~64 GB) | bs 4 x4 (~64 GB) | bs 8 x2 (~114 GB) | bs 8 x2 (~114 GB) | bs 8 x2 (~114 GB) |
| gemma4-e2b full | bs 1 x16 (~40 GB) | bs 2 x8 (~53 GB) | bs 4 x4 (~78 GB) | bs 8 x2 (~129 GB) | bs 8 x2 (~129 GB) | bs 8 x2 (~129 GB) |
| qwen35-4b lora | bs 2 x8 (~38 GB) | bs 4 x4 (~63 GB) | bs 4 x4 (~63 GB) | bs 8 x2 (~113 GB) | bs 8 x2 (~113 GB) | bs 8 x2 (~113 GB) |
| qwen35-4b full | no (~48 GB at bs 1) | bs 2 x8 (~61 GB) | bs 4 x4 (~86 GB) | bs 8 x2 (~136 GB) | bs 8 x2 (~136 GB) | bs 8 x2 (~136 GB) |

"bs 2 x8" means `--set optim.perDeviceBatchSize=2 --set optim.gradientAccumulationSteps=8`. DPO
scores chosen and rejected together, so it needs about one tier more for the same micro-batch
(its configs default to 1 x16). Above 64 GB, `sudo sysctl iogpu.wired_limit_mb=...` (RAM minus
8 GB) lets MLX use more before macOS pushes back; set `mlx.wiredLimitGb` to match.

**Time (planning numbers).** Assuming ~700 trained tokens/s for E4B LoRA and ~450 for full
fine-tuning on an M3 Ultra (E2B about 1.6x faster), and ~2k tokens per SFT dialogue. Each run
prints its real `tokens_per_s` and `eta_h` after the first few steps; trust those.

| Stage | Round 1 (10k jobs, ~7k dialogues) | Full (57k jobs, ~40k dialogues) |
|---|---|---|
| Teacher data (Qwen3.5-122B-A10B, revise on / off) | ~4.4 / 2.4 days | ~26 / 14 days |
| Bake-off, 2 LoRA runs on 5k dialogues | ~8 h each | same |
| SFT E4B LoRA / full, 2 epochs | ~11 h / ~17 h | ~2.7 / ~4 days |
| DPO candidates (5k / 20k prompts x 4) + local judging | ~15 h | ~2.5 days |
| DPO E4B (LoRA, ~5k / ~20k pairs, incl. reference pass) | ~10 h | ~40 h |
| Export, smoke test, evaluation (700 dialogues) | ~6 h | same |

**Disk.** About 150 GB plus the teacher: the teacher's weights (45 to 380 GB, see the table
above); Hugging Face cache for E4B, E2B and Qwen3.5-4B (~36 GB); MLX checkpoints (LoRA: ~1 GB
each; E4B full: ~24 GB each, 2 kept); the merged export (16 GB per model); GGUFs (bf16
intermediate 16 GB, Q4_0 ~5 GB); data (a few GB).

**Copy the GGUF back** (from your laptop):

```sh
rsync -avP mac-studio:italia/training/out/gguf/ ./training/out/gguf/
rsync -avP mac-studio:italia/training/out/eval/ ./training/out/eval/
```

Then follow "Putting the model in the app". The manifest step can run on the Mac too; commit
`models/manifest.json` from whichever machine runs `pnpm check`.

## Runbook B: rented NVIDIA GPU (secondary)

Use this when the Mac is busy or a deadline is tight. The stages are the same; the commands
differ only in the configs and launchers:

```sh
uv sync --extra gpu && CUDA=1 export/build_llama_cpp.sh
uv run python -m train.sft -c train/configs/bakeoff-gemma4-e4b.yaml      # bake-off, 1 GPU
uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \
  -m train.sft -c train/configs/sft-gemma4-e4b-full.yaml                  # release SFT
uv run python -m train.sample --model out/sft-gemma4-e4b-full/final --loader image-text-to-text \
  --prompts work/dpo/prompts.jsonl --out work/dpo/candidates.jsonl -k 4
uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \
  -m train.dpo -c train/configs/dpo-gemma4-e4b.yaml                       # TRL
uv run python -m export merge --model out/dpo-gemma4-e4b/final --out out/merged-e4b \
  --loader image-text-to-text                                            # no-op for full FT
uv run python -m export gguf --model out/merged-e4b --id italia-tutor-e4b --quant Q4_0
```

If the SFT model was LoRA, merge it first and point the DPO `policyModel` at the merged folder.
Data generation needs no GPU: run it on the Mac (local teacher) or anywhere with API access.

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
4. Run the commands above inside `tmux`. The Trainer saves checkpoints every `saveSteps`; resume
   with the same command after a pre-emption.
5. Copy `out/gguf/*.gguf` and `out/eval/` back. Stop the pod.

## Runbook C: local NVIDIA GPU

- **24 GB (RTX 3090 or 4090):**
  - SFT: LoRA for both E4B and E2B (`sft-gemma4-e4b-lora.yaml`, `sft-gemma4-e2b-lora.yaml`).
    Full fine-tuning does not fit.
  - DPO: `dpo-gemma4-e4b-lora.yaml`, starting from the merged SFT model.
  - Expected time is about 2 to 3 times the H100 figures: E4B LoRA on 40k dialogues takes about
    12 to 24 h, and E2B about half that.
- **16 GB:** E2B LoRA only. For E4B, add `--set loadIn4Bit=true` (QLoRA with Unsloth).
- Steps:
  1. Install the NVIDIA driver (CUDA 12.8+ runtime).
  2. Run `uv sync --extra gpu`.
  3. Run `CUDA=1 export/build_llama_cpp.sh`.
  4. Run the Runbook B commands with `--config_file train/configs/accelerate-1gpu.yaml`, or
     with plain `uv run python -m train.sft -c ...`.
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

- Neither training path has run on real hardware with the real models yet. The MLX path runs
  end to end in the test-suite (SFT, resume, DPO, fuse and re-layout to Hugging Face files) on a
  tiny model with MLX's CPU backend, and the re-layout reproduces the fused model exactly; the
  first Mac bake-off run is the integration test for Gemma 4 and Qwen3.5 on Metal. The NVIDIA
  stages were checked against the pinned library sources only.
- The memory, throughput and time tables are planning estimates from public single-stream
  benchmarks and simple models of batching; `datagen bench`, `metrics.jsonl` and the pilot will
  replace them.
- The seed lemma list (`data/lemmas.seed-v1.tsv`) comes from subtitle frequencies, with
  everyday words moved up to their CEFR level by the content pipeline (A1 words to rank 750, A2
  to 1,500; `packages/content/src/pipeline/everyday.ts`). The tutor's own A1 and A2 ceilings
  (500 and 1,000) are tighter, so `data/core_vocab.tsv` still lowers the ranks of the basic
  course vocabulary for band checks.
- No error-annotated Italian learner corpus exists, so the gold labels are the injected errors.
  Native-speaker spot checks remain essential, more so with a local teacher.
