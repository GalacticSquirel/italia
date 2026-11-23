"""Which /v1/chat/completions grammar options make Gemma 4 return empty content on llama-server.
usage (from training/): chat_probe.py URL item_id"""

import json
import sys
import urllib.request

sys.path.insert(0, ".")
from spec.models import output_json_schema  # noqa: E402

url, iid = sys.argv[1], sys.argv[2]
items = {json.loads(l)["id"]: json.loads(l) for l in open("work/eval/bench.jsonl", encoding="utf-8")}
msgs = items[iid]["messages"]
S = {"type": "json_schema", "json_schema": {"name": "t", "strict": True, "schema": output_json_schema()}}


def post(body):
    req = urllib.request.Request(url + "/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


base = {"messages": msgs, "max_tokens": 400, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False}}
variants = [
    ("response_format json_schema", {"response_format": S}),
    ("  + reasoning_format none", {"response_format": S, "reasoning_format": "none"}),
    ("json_schema (top-level field)", {"json_schema": output_json_schema()}),
    ("response_format json_object", {"response_format": {"type": "json_object"}}),
    ("json_schema, no chat_template_kwargs", {"response_format": S, "chat_template_kwargs": {}}),
    ("no grammar", {}),
]
for label, extra in variants:
    r = post({**base, **extra})
    c = r["choices"][0]
    m = c["message"]
    print(f"{label}: finish {c['finish_reason']}, tokens {r['usage']['completion_tokens']}, "
          f"content {(m.get('content') or '')[:70]!r}, reasoning {(m.get('reasoning_content') or '')[:70]!r}")
