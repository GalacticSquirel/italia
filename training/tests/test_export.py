from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import jsonschema
import pytest

from export.__main__ import main as export_main
from export.calibration import calibration_text
from export.gguf import LlamaCpp, gguf_name, plan_export, quantize_command
from export.manifest import MANIFEST, MANIFEST_SCHEMA, manifest_entry, sha256_file, upsert_entry
from export.merge import adapter_base, is_adapter
from export.smoke import check_answer, run_smoke, smoke_cases
from tests.helpers import output

LLAMA = LlamaCpp(Path("/opt/llama.cpp"))


def test_plan_export_with_imatrix() -> None:
    plan = plan_export(
        LLAMA,
        Path("/m"),
        Path("/o"),
        "italia-tutor-e4b",
        quants=["Q4_0", "Q4_K_M"],
        calibration=Path("/c.txt"),
    )
    convert, imatrix, q4, q4k = plan.commands
    assert convert[:2] == [
        "/opt/llama.cpp/.venv/bin/python",
        "/opt/llama.cpp/convert_hf_to_gguf.py",
    ]
    assert convert[-2:] == ["--outtype", "bf16"]
    assert imatrix[0].endswith("llama-imatrix") and "/c.txt" in imatrix
    assert q4 == [
        "/opt/llama.cpp/build/bin/llama-quantize",
        "--imatrix",
        "/o/italia-tutor-e4b.imatrix",
        "/o/italia-tutor-e4b-bf16.gguf",
        "/o/italia-tutor-e4b-q4_0-imat.gguf",
        "Q4_0",
    ]
    assert q4k[-1] == "Q4_K_M"
    assert [p.name for p in plan.outputs] == [
        "italia-tutor-e4b-q4_0-imat.gguf",
        "italia-tutor-e4b-q4_k_m-imat.gguf",
    ]


def test_plan_export_default_is_plain_q4_0() -> None:
    plan = plan_export(LLAMA, Path("/m"), Path("/o"), "t")
    assert len(plan.commands) == 2 and plan.commands[1][-1] == "Q4_0"
    assert "--imatrix" not in plan.commands[1]
    assert gguf_name("t", "Q4_0", False) == "t-q4_0.gguf"
    with pytest.raises(ValueError):
        quantize_command(LLAMA, Path("a"), Path("b"), "Q2_K")
    assert len(LLAMA.check()) == 4


def test_gguf_dry_run_cli(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    code = export_main(
        [
            "gguf",
            "--model",
            "/m",
            "--id",
            "x",
            "--out-dir",
            str(tmp_path),
            "--dry-run",
            "--llama-cpp",
            "/opt/llama.cpp",
        ]
    )
    assert code == 0
    assert "llama-quantize" in capsys.readouterr().out


def test_manifest_entry_and_upsert(tmp_path: Path) -> None:
    gguf = tmp_path / "m.gguf"
    gguf.write_bytes(b"GGUF" + bytes(1000))
    entry = manifest_entry(
        gguf,
        model_id="italia-tutor-e4b-q4_0",
        url="https://models.example/italia-tutor-e4b-q4_0.gguf",
        licence="Apache-2.0",
    )
    assert entry["sha256"] == hashlib.sha256(gguf.read_bytes()).hexdigest()
    assert entry["sizeBytes"] == 1004
    assert sha256_file(gguf, chunk_size=7) == entry["sha256"]
    manifest = tmp_path / "manifest.json"
    shutil.copy(MANIFEST, manifest)
    upsert_entry(entry, manifest, MANIFEST_SCHEMA)
    upsert_entry({**entry, "sizeBytes": 5}, manifest, MANIFEST_SCHEMA)  # replaces by id
    data = json.loads(manifest.read_text())
    assert [m["sizeBytes"] for m in data["models"]] == [5]
    with pytest.raises(jsonschema.ValidationError):
        upsert_entry({**entry, "url": "http://insecure"}, manifest, MANIFEST_SCHEMA)


def test_adapter_detection(tmp_path: Path) -> None:
    assert not is_adapter(tmp_path)
    (tmp_path / "adapter_config.json").write_text('{"base_model_name_or_path": "base/x"}')
    assert is_adapter(tmp_path) and adapter_base(tmp_path) == "base/x"


def test_calibration_text_includes_replies_and_json() -> None:
    rows = [
        {
            "messages": [
                {"role": "system", "content": "S"},
                {"role": "user", "content": "ciao"},
                {"role": "assistant", "content": output("Buongiorno!").to_json()},
            ]
        }
    ]
    text = calibration_text(rows * 3, max_chars=10_000)
    assert "Tutor: Buongiorno!" in text and '"reply"' in text and "Studente: ciao" in text
    assert calibration_text(rows, max_chars=5) == ""


def test_smoke_cases_and_checks() -> None:
    cases = smoke_cases()
    assert len(cases) == 3 and all(c.messages[-1]["role"] == "user" for c in cases)
    ok = check_answer(cases[0], output("Ecco il cappuccino!").to_json())
    assert ok.valid and ok.behaved
    warn = check_answer(cases[1], output("Bello!").to_json())
    assert warn.valid and not warn.behaved
    bad = check_answer(cases[0], "Ecco!")
    assert not bad.valid
    results = run_smoke(lambda messages: output("Bene!").to_json())
    assert [r.valid for r in results] == [True, True, True]
