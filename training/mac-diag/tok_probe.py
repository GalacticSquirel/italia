"""Token-level probe on llama-server: for given items, the first tokens (ids + pieces, special
tokens included) of the unconstrained completion, then the constrained variants:
json_schema (as eval/app), json_schema + "{" prefill, and a whitespace-free GBNF.
usage: tok_probe.py URL item_id [item_id ...]"""

import json
import sys
import urllib.request

sys.path.insert(0, ".")
from spec.models import output_json_schema  # noqa: E402

url = sys.argv[1]
ids = sys.argv[2:]
items = {json.loads(l)["id"]: json.loads(l) for l in open("work/eval/bench.jsonl", encoding="utf-8")}
KW = {"enable_thinking": False}


def post(path, body):
    req = urllib.request.Request(url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


for iid in ids:
    msgs = items[iid]["messages"]
    prompt = post("/apply-template", {"messages": msgs, "chat_template_kwargs": KW})["prompt"]
    r = post("/completion", {"prompt": prompt, "n_predict": 12, "temperature": 0, "n_probs": 3,
                             "return_tokens": True, "special": True})
    toks = r.get("tokens") or []
    pieces = [p.get("token", "?") for p in r.get("completion_probabilities", [])]
    print(f"## {iid}\n  unconstrained first tokens: {list(zip(toks[:12], pieces[:12]))}")
    for p in r.get("completion_probabilities", [])[:2]:
        print("   top alternatives:", [(t.get("token"), round(t.get("logprob", 0), 2)) for t in p.get("top_logprobs", [])])
    schema = output_json_schema()
    for label, body in (
        ("json_schema", {"response_format": {"type": "json_schema", "json_schema": {"name": "t", "strict": True, "schema": schema}}}),
    ):
        c = post("/v1/chat/completions", {"messages": msgs, "max_tokens": 400, "temperature": 0,
                                          "chat_template_kwargs": KW, **body})["choices"][0]
        t = c["message"].get("content") or ""
        print(f"  {label}: finish {c['finish_reason']}, {len(t)} chars, head {t[:60]!r}")
    # grammar from the schema (server-side conversion), sent raw on /completion, with "{" prefill
    g = post("/completion", {"prompt": prompt, "n_predict": 400, "temperature": 0, "json_schema": schema})
    print(f"  /completion json_schema: stop {g.get('stop_type')}, {len(g['content'])} chars, head {g['content'][:60]!r}")
    g2 = post("/completion", {"prompt": prompt + "{", "n_predict": 400, "temperature": 0})
    print(f"  prefill '{{' unconstrained: {len(g2['content'])} chars, head {'{' + g2['content'][:60]!r}")
