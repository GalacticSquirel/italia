"""Predictions from a llama-server endpoint with NO response_format at all (eval predict sends
json_object when constrained is false, which llama-server also turns into a grammar).
Optional prefill: the assistant turn starts with PREFILL (e.g. "{") via raw /completion.
usage: raw_predict.py URL MODEL SYSTEM items.jsonl out.jsonl [prefill]"""

import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

url, model, system, items_path, out_path = sys.argv[1:6]
prefill = sys.argv[6] if len(sys.argv) > 6 else ""
items = [json.loads(l) for l in open(items_path, encoding="utf-8")]
done = set()
try:
    done = {json.loads(l)["itemId"] for l in open(out_path, encoding="utf-8") if json.loads(l)["system"] == system}
except FileNotFoundError:
    pass


def post(path, body):
    req = urllib.request.Request(url + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


def one(it):
    t0 = time.time()
    kw = {"enable_thinking": False}
    if prefill:
        prompt = post("/apply-template", {"messages": it["messages"], "chat_template_kwargs": kw})["prompt"] + prefill
        r = post("/completion", {"prompt": prompt, "n_predict": 400, "temperature": 0})
        text = prefill + r["content"]
    else:
        r = post("/v1/chat/completions", {"model": model, "messages": it["messages"], "max_tokens": 400,
                                          "temperature": 0, "chat_template_kwargs": kw})
        text = r["choices"][0]["message"].get("content") or ""
    return {"itemId": it["id"], "system": system, "text": text.strip(), "latencyMs": round(1000 * (time.time() - t0), 1)}


todo = [it for it in items if it["id"] not in done]
with ThreadPoolExecutor(max_workers=8) as ex, open(out_path, "a", encoding="utf-8") as out:
    for row in ex.map(one, todo):
        out.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"{system}: {len(todo)} new predictions -> {out_path}")
