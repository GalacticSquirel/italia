from pathlib import Path


def sub(path, old, new, count=1):
    p = Path(path)
    s = p.read_text()
    assert s.count(old) == count, (path, old[:70], s.count(old))
    p.write_text(s.replace(old, new))


sub(
    "README.md",
    "uv run --extra mlx mlx_lm.server --model mlx-community/Qwen3.5-122B-A10B-4bit \\",
    "uv run --extra mlx python -m datagen.serve_teacher --model mlx-community/Qwen3.5-122B-A10B-4bit \\",
)
sub(
    "README.md",
    'uv run --extra mlx mlx_lm.server --model "$LOCAL_TEACHER_MODEL" --port 8080 \\',
    'uv run --extra mlx python -m datagen.serve_teacher --model "$LOCAL_TEACHER_MODEL" --port 8080 \\',
)
sub(
    "datagen/configs/local-mac.yaml",
    "#   uv run --extra mlx mlx_lm.server --model mlx-community/Qwen3.5-122B-A10B-4bit \\",
    "#   uv run --extra mlx python -m datagen.serve_teacher --model mlx-community/Qwen3.5-122B-A10B-4bit \\",
)
# Note under the "Local teacher on the Mac" intro paragraph.
sub(
    "README.md",
    "| Unified memory | Recommended teacher (MLX 4-bit) | Weights | Alternative |\n",
    "**Serve it with `python -m datagen.serve_teacher`**, which takes `mlx_lm.server`'s arguments and\n"
    "first patches a buffer leak in mlx-lm 0.32.2 (`datagen/mlx_compat.py`; upstream\n"
    "ml-explore/mlx-lm#1641 and #1845). Plain `mlx_lm.server` with a hybrid teacher (Qwen3-Next,\n"
    "Qwen3.5) dies after about 499000 / (linear-attention layers - 1) batched decode steps, about\n"
    "8 minutes for Qwen3-Next-80B, with `[metal::malloc] Resource limit (499000) exceeded`; the HTTP\n"
    "side stays up and answers 404. On 64 GB, use `--prompt-concurrency 2`: 4 concurrent ~3k-token\n"
    "prefills next to the 42 GiB Qwen3-Next weights run out of Metal memory.\n"
    "\n"
    "| Unified memory | Recommended teacher (MLX 4-bit) | Weights | Alternative |\n",
)
print("docs patched")
