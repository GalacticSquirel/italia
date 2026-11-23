"""Diagnostic: for the first N jobs, record whether the draft and the revise pass parse."""
import json, sys, concurrent.futures as cf
from pathlib import Path
from datagen.config import load_config
from datagen.runner import select_scenarios, build_jobs
from datagen.teacher import make_client
from datagen import synthesis as S
from spec.scenarios import load_library

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
scen = select_scenarios(cfg, load_library()); by = {s.id: s for s in scen}
jobs = build_jobs(cfg, scen)[: int(sys.argv[1])]
t = make_client(cfg.teacher)
out = Path.home() / "italia-diag" / "stage.jsonl"

def one(job):
    ctx, persona, plan = S.prepare(job, by[job.scenario_id], cfg)
    brief = S.make_brief(ctx, persona, plan)
    r = {"id": job.id, "n_learner": len(plan), "level": job.level}
    c = t.complete([{"role": "user", "content": brief}], temperature=cfg.teacher_temperature,
                   max_tokens=cfg.teacher_max_tokens, json_output=True)
    r["draft_raw"] = c.text
    try:
        turns = S.parse_dialogue(c.text, len(plan)); r["draft"] = "ok"
    except S.SynthesisError as e:
        r["draft"] = str(e); return r
    f = t.complete([{"role": "user", "content": S._REVISE_INSTRUCTIONS.format(brief=brief, dialogue=S.dialogue_json(turns))}],
                   temperature=0.2, max_tokens=cfg.teacher_max_tokens, json_output=True)
    r["revise_raw"] = f.text
    try:
        S.parse_dialogue(f.text, len(plan)); r["revise"] = "ok"
    except S.SynthesisError as e:
        r["revise"] = str(e)
    return r

with cf.ThreadPoolExecutor(8) as ex, out.open("w") as fh:
    for r in ex.map(one, jobs):
        fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(r["id"], r["n_learner"], "draft:", r["draft"], "| revise:", r.get("revise", "-"), flush=True)
