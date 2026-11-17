"""Export the Italian phoneme recognizer to a quantized ONNX file for the app.

Source checkpoint: Cnam-LMSSC/wav2vec2-italian-phonemizer (MIT), pinned to a
revision below. The exported graph:

- input  ``audio``: float32 ``[1, samples]``, mono 16 kHz, raw amplitude in [-1, 1]
  (zero-mean, unit-variance normalisation is part of the graph, as the
  checkpoint's feature extractor has ``do_normalize: true``);
- output ``logits``: float32 ``[1, frames, 39]``, one frame per 20 ms, labels as
  in the checkpoint's ``vocab.json`` plus ``added_tokens.json`` (``[PAD]``, id 36,
  is the CTC blank; ``<s>`` and ``</s>``, ids 37 and 38, are never emitted).

Weights of MatMul/Gemm nodes are dynamically quantized to int8; the
convolutional feature encoder stays in float32.

Usage (Python 3.13; pinned versions make the output byte-reproducible):

    python -m venv .venv
    .venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.9.1
    .venv/bin/pip install transformers==4.57.3 onnx==1.19.1 onnxruntime==1.23.2 onnxscript
    .venv/bin/python -I models/scripts/export_phonemizer.py OUT_DIR

Then upload ``OUT_DIR/wav2vec2-italian-phonemizer.int8.onnx`` to the release named
in ``models/manifest.json`` and check that its SHA-256 matches the manifest.
"""

import hashlib
import sys
from pathlib import Path

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import Wav2Vec2ForCTC

REPO = "Cnam-LMSSC/wav2vec2-italian-phonemizer"
REVISION = "9373b68cac253d695196049f8df3f2985f3db4ae"
NAME = "wav2vec2-italian-phonemizer"


class Normalised(torch.nn.Module):
    """Per-utterance zero-mean, unit-variance normalisation, then the CTC model."""

    def __init__(self, model: torch.nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, audio: torch.Tensor) -> torch.Tensor:
        mean = audio.mean(dim=-1, keepdim=True)
        var = audio.var(dim=-1, keepdim=True, unbiased=False)
        x = (audio - mean) / torch.sqrt(var + 1e-7)
        return self.model(x).logits


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(0)
    model = Wav2Vec2ForCTC.from_pretrained(
        REPO, revision=REVISION, attn_implementation="eager"
    ).eval()
    wrapped = Normalised(model).eval()
    fp32 = out / f"{NAME}.fp32.onnx"
    dummy = torch.zeros(1, 16000)
    with torch.no_grad():
        torch.onnx.export(
            wrapped,
            (dummy,),
            str(fp32),
            input_names=["audio"],
            output_names=["logits"],
            dynamic_axes={"audio": {1: "samples"}, "logits": {1: "frames"}},
            opset_version=17,
            dynamo=False,
        )
    int8 = out / f"{NAME}.int8.onnx"
    quantize_dynamic(
        str(fp32),
        str(int8),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["MatMul", "Gemm"],
    )
    fp32.unlink()
    print(f"{int8.name} {int8.stat().st_size} {sha256(int8)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "phonemizer-onnx")
