#!/bin/zsh
# after the round9m judge: fuse round9m-b10 (alpha 0.5, beta 1.0), then judge it
cd ~/code/italia/training
until grep -q "=== .* judged$" ~/italia-diag/r9m-pipeline.log; do sleep 20; done
sleep 10
zsh -lc "uv run --extra mlx python ~/italia-diag/interp2.py out/merged/round8-sft out/merged/round9-dpo out/merged/round9c-dpo 0.5 1.0 out/merged/round9m-b10 2>&1 | tail -1" | tee -a ~/italia-diag/r9m-pipeline.log
~/italia-diag/r9m_judge_b10.sh
