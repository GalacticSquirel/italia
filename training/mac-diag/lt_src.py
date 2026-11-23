"""Read-only: LanguageTool matches on the tutor turns of hand-written source dialogues.
usage (from training/): lt_src.py file.yaml:index [file.yaml:index ...]"""

import sys

import yaml

from datagen.languagetool import LanguageToolClient

lt = LanguageToolClient("http://localhost:8010/v2")
for spec in sys.argv[1:]:
    path, idx = spec.rsplit(":", 1)
    dialogue = yaml.safe_load(open(path, encoding="utf-8"))[int(idx)]
    print(f"## {path}[{idx}] ({dialogue['scenario']})")
    for turn in dialogue["turns"]:
        text = turn.get("tutor")
        if not text:
            continue
        for m in lt.check(text):
            print(f"  {m.rule_id}: '{m.span(text)}' in: {text}")
