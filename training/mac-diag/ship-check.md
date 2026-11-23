# Ship check: round12m GGUF (2026-11-21)

All files are local on the Mac Studio (`training/out/gguf-round12m/`). Nothing was uploaded.

## Pipeline
- llama.cpp **b11804** (the llama.rn 0.13.0-rc.8 build), built with `export/build_llama_cpp.sh` (Metal).
- `export gguf --model out/merged/round12m --id italia-tutor-e4b --quant Q4_0 --imatrix work/calibration.txt`.
  The calibration text is 2.0M characters from `work/sft-round8/sft.train.jsonl`.
- **Toolchain fix needed:** llama.cpp's convert requirements pin transformers 4.57.6. That version cannot load Gemma 4's
  list-style `extra_special_tokens` (`AttributeError: 'list' object has no attribute 'keys'`). Installing
  transformers 5.17.0 (the training venv's version) into `work/llama.cpp/.venv` fixes it.
- `export smoke` needs the `llama-cpp-python` package, which is not installed. I skipped it; the full bench replaces it.

## Files
| file | bytes | sha256 |
|---|---|---|
| italia-tutor-e4b-q4_0-imat.gguf (llama-quantize defaults) | 5,163,133,504 | c9b36ef02a1053eeb8ca6ffc15410a4f61f24203e08d80088cdbf21081e4199c |
| italia-tutor-e4b-q4_0-imat-stocktypes.gguf (tensor types as stock) | 4,590,807,616 | 1d3ed64403da9e185dbeff65dea32a0df28bcbd92405613465283dc950ea4e1f |
| italia-tutor-e4b-q4km-imat.gguf (Q4_K_M) | 5,302,274,624 | fd71429dc6c00145153d206671baf3cc734fc06c1ebb2ec55894ccd8309b6d82 |
| italia-tutor-e4b-q5km-imat.gguf (Q5_K_M) | 5,723,998,784 | 975655df401a9deedc0b2304d77f6107033a46833a73e0f4f1b60448af167281 |
| italia-tutor-e4b-q8-imat.gguf (Q8_0) | 7,972,727,360 | bf90c78f8bc4f85427c31b26fe9b52dabd73aa1e7f0f9d86a62f41dccb367254 |
| italia-tutor-e4b-bf16.gguf (intermediate) | 14,942,972,256 | - |

The stock `gemma-4-E4B-it-Q4_0.gguf` from the manifest is 4,590,807,392 bytes, sha256 a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2. I verified it against the manifest, used it as the control, then deleted it.

## Why ours is 5.16 GB and stock is 4.59 GB
I compared the headers with `~/italia-diag/gguf_head.py`, reading the stock file from a 32 MB range fetch.

The two files match on everything except tensor types:
- Identical metadata: rope dims 512/256, freq bases 1e6/1e4, key/value lengths, SWA pattern, shared-KV layers and softcap.
- A byte-identical chat template.
- The same 666 tensors with the same shapes.

The only differences are tensor types:

| tensor | ours | stock |
|---|---|---|
| `per_layer_token_embd` | Q6_K | Q4_0 |
| `token_embd` | Q6_K | Q8_0 |
| 5 × `ffn_down` | Q4_1 | Q4_0 |

To build a file that matches stock:
`llama-quantize --imatrix <imatrix> --token-embedding-type q8_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q4_0 <bf16.gguf> <out.gguf> Q4_0`.
The two Q4_0 variants score the same within about 1 point, so the extra 0.57 GB buys nothing.

## Bug 1 (serving): empty output with a grammar on b11804 (fixed)
**What happens:** with any grammar on `/v1/chat/completions`, llama-server's Gemma 4 chat format admits a thought channel. This applies to `response_format` json_schema, `response_format` json_object, and a `json_schema` field.
- The model enters `<|channel>thought …` and reasons until `max_tokens` runs out.
- The result is empty `content` with `finish_reason: length`.
- The stock Q4_0 does the same: 107 of 200 outputs invalid.
- `chat_template_kwargs {enable_thinking: false}` does not prevent it.
- Without a grammar the first token is `{"` (logprob 0.0), with `<|channel>` behind it at −16.

**Fix:** start the server with `--reasoning-budget 0`. The model then emits an empty, closed `<|channel>thought<channel|>`, which the default `reasoning_format` strips from `content`, followed by the JSON. All outputs are valid.

Working request (b11804):
```
llama-server -m <gguf> --jinja --reasoning-budget 0 -c 65536 -np 8 -ngl 99
POST /v1/chat/completions
{"messages": [...], "max_tokens": 400, "temperature": 0,
 "chat_template_kwargs": {"enable_thinking": false},
 "response_format": {"type": "json_schema",
   "json_schema": {"name": "tutor_output", "strict": true, "schema": <output_json_schema()>}}}
```
- **Scoring:** score `choices[0].message.content`. None of the 801 outputs contained a ``` fence or a channel marker.
- **llama.rn:** pass the equivalent zero reasoning or thinking budget whenever a grammar is used. I have not verified this in llama.rn.
- **Alternative:** raw `/completion` with `json_schema` also works (template applied with `/apply-template`, no chat format).

## Bug 2 (quality): Q4_0 loses about 11 points of under-correction (quantization, not the runtime)
Bench (801 items) and learner-v2 (595 items), snap mode. GGUF rows are served the app way (`--reasoning-budget 0` plus json_schema) unless marked "no grammar".

| | float (mlx) | bf16 GGUF (no grammar) | Q4_0 | Q4_0 stock types | Q4_0 (no grammar) | Q4_K_M | Q5_K_M | Q8_0 |
|---|---|---|---|---|---|---|---|---|
| size GB | - | 14.94 | 5.16 | 4.59 | 5.16 | 5.30 | 5.72 | 7.97 |
| JSON validity | 100 | 100 | 100 | 100 | 100 | 100 (raw 99.6) | 100 (99.3) | 100 (99.6) |
| move accuracy | 87.9 | 87.3 | 82.5 | 82.6 | 82.0 | 85.4 | 86.0 | 87.3 |
| over-correction | 6.2 | 6.7 | 3.1 | 3.1 | 2.8 | 5.9 | 8.2 | 7.7 |
| under-correction | 13.8 | 15.0 | 25.2 | 25.2 | 28.3 | 16.5 | 13.3 | 12.8 |
| correction accuracy | 76.3 | 75.8 | 64.2 | 63.9 | 62.5 | 71.2 | 75.5 | 77.5 |
| recast correctness | 68.6 | 67.5 | 52.6 | 53.6 | 52.6 | 61.9 | 64.9 | 67.0 |
| answer-giving | 1.0 | 0.5 | 3.6 | 4.1 | 3.3 | 2.0 | 1.0 | 1.5 |
| over band limit | 4.9 | 4.2 | 8.5 | 8.6 | 8.0 | 4.6 | 3.4 | 3.3 |
| L-v2 detection /317 | 266 | 264 | 224 | 227 | 220 | 248 | 252 | 254 |
| L-v2 false flags /278 | 110 | 105 | 83 | 81 | 74 | 107 | 114 | 106 |

Under-correction by level (A1 / A2 / B1 / B2 / C1 / C2):

| | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| float | 1 | 7 | 20 | 14 | 15 | 24 |
| bf16 GGUF | 1 | 7 | 22 | 16 | 16 | 25 |
| Q4_0 | 5 | 15 | 39 | 26 | 23 | 42 |
| Q4_K_M | 3 | 10 | 19 | 16 | 18 | 31 |
| Q5_K_M | 1 | 7 | 20 | 11 | 12 | 27 |
| Q8_0 | 1 | 3 | 19 | 11 | 11 | 28 |

Reading:
- **Conversion and runtime are fine.** The bf16 GGUF on llama.cpp is within about 1 point of float, so the template is fine too.
- **The loss is Q4_0 itself.** Q4_0 is equally bad with or without the grammar and thought prefix.
  - The tuned model corrects far less: under-correction ×1.8, over-correction ÷2. It also recasts worse.
  - The likely cause is that bf16 LoRA fine-tuning moved the weights off the base checkpoint's QAT Q4_0 grid, so the QAT advantage is gone. The stock model is true QAT.
- **Q4_K_M** recovers most of the gap: under-correction +2.7, recast −6.7.
- **Q5_K_M** is about float on under-correction (−0.5), but over-correction is +2.0 and recast −3.7.
- **Q8_0** is the closest overall, but it is 7.97 GB.
- **No variant is within 1 point** on all of over-correction, under-correction and recast. Q8_0 comes closest.

## Options
1. Ship Q4_K_M (5.30 GB) or Q5_K_M (5.72 GB) where RAM allows. export/gguf.py says llama.rn's Adreno OpenCL path accelerates Q4_0, so K-quants may be slower on Android GPUs; this needs a device bench.
2. Make Q4_0 work again: run a short QAT, or quantization-aware fine-tune, of round12m with fake-quant Q4_0 in the forward pass. The training README suggests this when the bf16→Q4_0 gap exceeds 2–3 points. Then re-export Q4_0 with stock tensor types.
3. Mixed-precision Q4_0: keep the attention and ffn_down tensors at Q5/Q6 through `--tensor-type` overrides (untested).
