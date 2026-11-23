"""Parse a GGUF header (metadata + tensor table) from the first bytes of a file; no tensor data
needed. Prints selected metadata and per-tensor types; with two files, a diff.
usage: gguf_head.py A.gguf [B.gguf]"""

import struct
import sys
from collections import Counter

from gguf.constants import GGMLQuantizationType as Q

SCALAR = {0: "B", 1: "b", 2: "H", 3: "h", 4: "I", 5: "i", 6: "f", 7: "?", 10: "Q", 11: "q", 12: "d"}


def parse(path):
    f = open(path, "rb")

    def rd(fmt):
        n = struct.calcsize("<" + fmt)
        return struct.unpack("<" + fmt, f.read(n))[0]

    def rstr():
        n = rd("Q")
        return f.read(n).decode("utf-8", "replace")

    def rval(t):
        if t == 8:
            return rstr()
        if t == 9:
            it, n = rd("I"), rd("Q")
            vals = [rval(it) for _ in range(n)]
            return vals
        return rd(SCALAR[t])

    assert f.read(4) == b"GGUF"
    rd("I")
    nt, nkv = rd("Q"), rd("Q")
    kv = {}
    for _ in range(nkv):
        k = rstr()
        t = rd("I")
        kv[k] = rval(t)
    tensors = {}
    for _ in range(nt):
        name = rstr()
        nd = rd("I")
        dims = [rd("Q") for _ in range(nd)]
        typ = rd("I")
        rd("Q")
        tensors[name] = (Q(typ).name, dims)
    return kv, tensors


def size_of(tensors):
    from gguf.constants import GGML_QUANT_SIZES
    total = 0
    for name, (typ, dims) in tensors.items():
        bs, ts = GGML_QUANT_SIZES[Q[typ]]
        n = 1
        for d in dims:
            n *= d
        total += n // bs * ts
    return total


files = sys.argv[1:]
parsed = [parse(p) for p in files]
for p, (kv, t) in zip(files, parsed):
    print(f"## {p}: {len(t)} tensors, data {size_of(t)/1e9:.3f} GB")
    for k in sorted(kv):
        if any(s in k for s in ("rope", "head_count", "key_length", "value_length", "sliding", "embedding_length",
                                "shared_kv", "general.file_type", "context_length", "quantization", "final_logit")):
            v = kv[k]
            print(f"  {k} = {v if not isinstance(v, list) else (v[:12], len(v))}")
    print("  types:", dict(Counter(typ for typ, _ in t.values())))
if len(parsed) == 2:
    (ka, ta), (kb, tb) = parsed
    print("## metadata differences (excluding tokenizer.*):")
    for k in sorted(set(ka) | set(kb)):
        if k.startswith("tokenizer.") and k != "tokenizer.chat_template":
            continue
        if ka.get(k) != kb.get(k):
            va, vb = ka.get(k), kb.get(k)
            if k == "tokenizer.chat_template":
                print(f"  {k}: differs (len {len(va or '')} vs {len(vb or '')})")
            else:
                print(f"  {k}: {va if not isinstance(va, list) else va[:8]}  vs  {vb if not isinstance(vb, list) else vb[:8]}")
    print("## tensor differences:")
    onlya, onlyb = set(ta) - set(tb), set(tb) - set(ta)
    if onlya:
        print("  only in A:", sorted(onlya)[:10], len(onlya))
    if onlyb:
        print("  only in B:", sorted(onlyb)[:10], len(onlyb))
    diff = Counter()
    ex = {}
    for name in set(ta) & set(tb):
        if ta[name] != tb[name]:
            key = (ta[name][0], tb[name][0], ta[name][1] == tb[name][1])
            diff[key] += 1
            ex.setdefault(key, name)
    for key, n in diff.most_common():
        print(f"  {n} tensors A {key[0]} vs B {key[1]} (same shape: {key[2]}), e.g. {ex[key]}")
