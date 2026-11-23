# Mac Studio diagnostics archive (2026-11-23)

Scripts and notes from `~/italia-diag` on the Mac Studio, archived before the Mac was sold.
These were run ad hoc and are not wired into the pipeline. Large data (jsonl, logs) and
compiled binaries are kept outside git, in `C:\Users\owen\italia\mac-archive\italia-diag`.

Key pieces:
- `qat.py`: quantization-aware LoRA training for GGUF. Q4_0 fake-quant is bit-exact with ggml;
  Q6_K reproduces `quantize_row_q6_K_ref` to within 0.03–0.05% of weights. QAT_Q6K=1 matches
  the mx2 export types. Modes: `sft`, `dpo`, `selftest`.
- `qat_pipeline.sh`, `qat2_pipeline.sh`, `qat3_pipeline.sh`, `qdpo_pipeline.sh`: QAT rounds.
- `mixq.sh`: mixed-precision exports. mx2 (ffn_down/attn_output Q6_K, token_embd Q4_0) is the
  ship candidate.
- `ship-check.md`: the app-path ship check (`--reasoning-budget 0`, tensor types, Q4_0 loss).
- `gate/`, `overcorr.py`, `undercorrection.py`: over- and under-correction diagnostics.
- `qref.c`, `qx*.c`: ggml quantizer reference harnesses.
