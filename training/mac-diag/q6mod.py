import os, sys
import mlx.core as mx, mlx.nn as nn, mlx.optimizers as optim
from mlx.utils import tree_flatten
sys.path.insert(0, os.path.expanduser("~/italia-diag"))
os.environ["QAT_Q6K"] = "1"
import qat
from mlx_lm.tuner.lora import LoRALinear

class Blk(nn.Module):
    def __init__(s):
        super().__init__()
        s.down_proj = LoRALinear.from_base(nn.Linear(512, 256, bias=False), r=8, scale=2.0)
        s.lora_b_init()
    def lora_b_init(s):
        s.down_proj.lora_b = mx.random.normal(s.down_proj.lora_b.shape) * 0.01
    def __call__(s, x): return s.down_proj(x)

class M(nn.Module):
    def __init__(s):
        super().__init__(); s.layers = [Blk()]
    def __call__(s, x): return s.layers[0](x)

class Root(nn.Module):
    def __init__(s):
        super().__init__(); s.model = M()
    def __call__(s, x): return s.model(x)

m = Root(); m.freeze(); m.unfreeze(keys=["lora_a", "lora_b"], strict=False)
names0 = [k for k, _ in tree_flatten(m.trainable_parameters())]
# name it like gemma: layers.0.mlp.down_proj -> use the real suffix check directly
print("qtype check:", qat._qtype("model.layers.0.mlp.down_proj"), qat._qtype("model.layers.0.self_attn.o_proj"), qat._qtype("model.layers.0.mlp.up_proj"))
mod = m.model.layers[0].down_proj
qat._bump_on_update()
qat._retype(mod, qat._make_lora_call(qat.QUANT["q6_k"]), "q6_k")
print("class name kept:", type(mod).__name__, "names same:", names0 == [k for k, _ in tree_flatten(m.trainable_parameters())])
x = mx.random.normal((4, 512))
def weff():
    return mod.linear.weight + ((mod.scale * mod.lora_b.T) @ mod.lora_a.T).astype(mod.linear.weight.dtype)
y = m(x); ref = x @ qat.q6_k(weff()).T
print("forward exact:", bool(mx.all(y == ref).item()))
loss = lambda mdl, x: (mdl(x) ** 2).mean()
vg = nn.value_and_grad(m, loss)
l, g = vg(m, x)
gn = {k: float(mx.abs(v).sum().item()) for k, v in tree_flatten(g)}
print("grads:", gn)
v0 = qat._VERSION[0]
opt = optim.Adam(1e-2); opt.update(m, g); mx.eval(m.parameters())
print("version bumped:", qat._VERSION[0] == v0 + 1)
y2 = m(x); ref2 = x @ qat.q6_k(weff()).T
print("forward exact after update (cache invalidated):", bool(mx.all(y2 == ref2).item()), "changed:", not bool(mx.all(y2 == y).item()))
y3 = m(x); print("cache hit same:", bool(mx.all(y3 == y2).item()))
