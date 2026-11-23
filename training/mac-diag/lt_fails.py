"""LanguageTool matches for every hand-written record that failed the rebuild.

usage (from training/): lt_fails.py fails-build.txt fails-bench.txt out.tsv
Matches are the ones LanguageToolClient.check counts (same ignored rules as the filter);
replacements come from LanguageTool's raw response for the same span and rule.
"""

import re
import sys
from pathlib import Path

import httpx

from datagen.handwritten import BENCH_SOURCE_DIR, SOURCE_DIR, compile_source, load_sources
from datagen.languagetool import LanguageToolClient
from spec.scenarios import load_library

URL = "http://localhost:8010/v2"
FAIL = re.compile(r"^\[(?P<set>[^\]]+)\] FAIL source (?P<file>[^\[]+)\[(?P<idx>\d+)\] \((?P<sc>[^)]+)\):")

client = LanguageToolClient(URL)
http = httpx.Client(timeout=30)
library = load_library()


def raw_matches(text: str) -> dict[tuple[int, int, str], list[str]]:
    r = http.post(URL + "/check", data={"language": "it", "text": text})
    r.raise_for_status()
    return {
        (m["offset"], m["length"], m["rule"]["id"]): [x["value"] for x in m.get("replacements", [])[:3]]
        for m in r.json().get("matches", [])
    }


rows = ["record\tscenario\tturn\trule\tmessage\tflagged (in context)\tsuggestions"]
n_records = n_matches = 0
for fails_file, src_dir, split in ((sys.argv[1], SOURCE_DIR, "train"), (sys.argv[2], BENCH_SOURCE_DIR, "eval")):
    for line in Path(fails_file).read_text(encoding="utf-8").splitlines():
        m = FAIL.match(line)
        if not m:
            continue
        n_records += 1
        set_name, rel, idx = m["set"], m["file"], int(m["idx"])
        source = next(s for s in load_sources(set_name, src_dir)
                      if s.path.name == Path(rel).name and s.index == idx)
        record = compile_source(source, library, split)
        for t, turn in enumerate(record.turns):
            if turn.output is None:
                continue
            text = turn.output.reply
            suggestions = raw_matches(text)
            for g in client.check(text):
                flagged = g.span(text)
                left = text[max(0, g.offset - 25) : g.offset]
                right = text[g.offset + g.length : g.offset + g.length + 25]
                ctx = f"…{left}«{flagged}»{right}…".replace("\t", " ").replace("\n", " ")
                sug = suggestions.get((g.offset, g.length, g.rule_id), [])
                rows.append("\t".join([f"{rel}[{idx}]", m["sc"], str(t), g.rule_id,
                                       g.message.replace("\t", " "), ctx, " | ".join(sug)]))
                n_matches += 1
Path(sys.argv[3]).write_text("\n".join(rows) + "\n", encoding="utf-8")
print(f"{n_records} records, {n_matches} matches -> {sys.argv[3]}")
