#!/bin/zsh
# Start r10_train.sh once ranking is done, if >= 400 judged pairs and gold-vs-worst <= 20% (pre-approved).
L=~/italia-diag/r10-pipeline.log
until grep -qE "=== .* (ranked|FAILED.*)$" $L; do sleep 20; done
grep -q FAILED $L && exit 1
line=$(grep -E "^pairs [0-9]+: judged" $L | tail -1)
n=$(echo $line | sed -E "s/^pairs ([0-9]+):.*/\1/"); j=$(echo $line | sed -E "s/.*judged ([0-9]+),.*/\1/"); g=$(echo $line | sed -E "s/.*gold-vs-worst ([0-9]+) .*/\1/")
if (( j >= 400 && g * 5 <= n )); then
  echo "=== $(date "+%F %T") auto-start: pairs $n, judged $j, gold $g" >> $L
  ~/italia-diag/r10_train.sh
else
  echo "=== $(date "+%F %T") STOP: pairs $n, judged $j, gold $g (pre-approval needs judged >= 400, gold <= 20%)" >> $L
fi
