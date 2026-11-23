"""App-path probe: A1 mercato-frutta, one learner turn after the scene opener, via /apply-template
(enable_thinking false) + /completion with json_schema = the app's runtimeOutputSchema (spec schema,
error tags and goal ids as enums). Sampling as the app: temp 0.7, top_k 64, top_p 0.95, min_p 0.05,
n_predict 512; 2 seeds plus a temperature-0 pass.
usage (from training/): app_probe.py URL label"""

import json
import sys
import urllib.request
from pathlib import Path

from datagen.handwritten import load_handwritten
from spec.models import output_json_schema
from spec.render import render_messages
from spec.taxonomy import error_tags

url, label = sys.argv[1], sys.argv[2]
TURNS = [
    "Vorrei due mela, per favore.",
    "Io ha mangiato una pesca ieri.",
    "Quanto costa le fragole?",
    "Vorrei un chilo di pomodoro rossi.",
    "Io sono comprato le mele.",
    "Le banane è buone?",
    "Grazie, io vuole anche il pane.",
    "Buongiorno, vorrei delle mele.",  # control: no error
]
rec = next(r for r in load_handwritten(sorted(Path("data/handwritten").glob("a1.jsonl")))
           if r.scenario_id == "mercato-frutta")
opener = render_messages(rec.context, rec.turns)[:3]  # system, [inizio], tutor opener


def runtime_schema():
    drop = {"$schema", "$id", "x-spec-version", "description"}

    def clone(v):
        if isinstance(v, list):
            return [clone(x) for x in v]
        if isinstance(v, dict):
            return {k: clone(x) for k, x in v.items() if k not in drop}
        return v

    s = clone(output_json_schema())
    tags = list(error_tags())  # taxonomy order, as the app ERROR_TAGS
    for d in ("Prompt", "Recast"):
        items = s["$defs"][d]["properties"]["errorTags"]["items"]
        items.pop("pattern", None)
        items["enum"] = list(tags)
    g = s["$defs"]["ScenarioProgress"]["properties"]["goalsCompleted"]
    g["items"].pop("pattern", None)
    g["items"]["enum"] = [x.id for x in rec.context.scenario.goals]
    g["maxItems"] = len(rec.context.scenario.goals)
    return s


SCHEMA = runtime_schema()


def post(path, body):
    req = urllib.request.Request(url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


results = []
for turn in TURNS:
    msgs = opener + [{"role": "user", "content": turn}]
    prompt = post("/apply-template", {"messages": msgs, "chat_template_kwargs": {"enable_thinking": False}})["prompt"]
    for mode, params in (("seed1", {"temperature": 0.7, "seed": 1}), ("seed2", {"temperature": 0.7, "seed": 2}),
                         ("t0", {"temperature": 0.0})):
        body = {"prompt": prompt, "json_schema": SCHEMA, "n_predict": 512, "top_k": 64, "top_p": 0.95,
                "min_p": 0.05, **params}
        r = post("/completion", body)
        text = r["content"]
        try:
            ann = json.loads(text)["annotations"]
            move = "prompt" if ann.get("prompt") else "recast" if ann.get("recast") else "none"
            fb = ann.get("prompt") or ann.get("recast") or {}
            reply = json.loads(text)["reply"]
        except Exception:
            move, fb, reply = "invalid", {}, text[:80]
        results.append({"turn": turn, "mode": mode, "move": move, "span": fb.get("learnerText"),
                        "tags": fb.get("errorTags"), "reply": reply,
                        "thought": "<|channel>" in text or "thought" in text[:20], "fence": "```" in text,
                        "stop": r.get("stop_type"), "tokens": r.get("tokens_predicted")})
errs = [r for r in results if r["turn"] != TURNS[-1]]
ctrl = [r for r in results if r["turn"] == TURNS[-1]]
sampled = [r for r in errs if r["mode"] != "t0"]
print(f"## {label}")
print(f"error turns x 2 seeds with prompt/recast: {sum(r['move'] in ('prompt', 'recast') for r in sampled)}/{len(sampled)}"
      f"; temperature 0: {sum(r['move'] in ('prompt', 'recast') for r in errs if r['mode'] == 't0')}/7")
print("control:", [(r["mode"], r["move"]) for r in ctrl])
print("thought block:", sum(r["thought"] for r in results), "fence:", sum(r["fence"] for r in results),
      "invalid:", sum(r["move"] == "invalid" for r in results), "stops:", sorted({str(r["stop"]) for r in results}))
for r in results:
    print(f"  [{r['mode']}] {r['turn']} -> {r['move']} {r['span']!r} {r['tags']} | {r['reply']}")
