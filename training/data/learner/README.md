# Real learner Italian

`merlin-it.jsonl`: 7,179 sentence pairs from the Italian part of the MERLIN corpus. Each row is a
sentence a learner wrote in a CEFR exam (rated A1 to B2) and the same sentence as corrected by a
native speaker (MERLIN's minimal "target hypothesis 1"), with the author's id, level, first
language and task. `changed` is true when the native corrector changed a word (punctuation and
capitals do not count, since the tutor hears speech). `split` holds out one author in five
(`eval`) for the real-learner check, except sentences a training author also wrote word for
word; the rest (`train`) may be used for training dialogues.

Rebuild it (downloads the pinned 12 MB release to `work/` and checks its sha256):

```sh
uv run python -m datagen merlin
```

Sentences with anonymised names ("Città X"), e-mail addresses or illegible passages are dropped,
as are sentences under 3 or over 40 words and pairs whose lengths differ by more than 40%.

## Attribution and licence

Derived from **MERLIN Corpus v1.2 – Text** (2018) by Katrin Wisniewski, Andrea Abel, Kateřina
Vodičková, Sybille Plassmann, Detmar Meurers, Claudia Woldt, Karin Schöne, Verena Blaschitz,
Verena Lyding, Lionel Nicolas, Chiara Vettori, Pavel Pečený, Jirka Hana, Veronika Čurdová, Barbora
Štindlová, Gudrun Klein, Louise Lauppe, Adriane Boyd, Serhiy Bykh and Julia Krivanek,
https://hdl.handle.net/20.500.12124/59, licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Changes: sentence splitting,
alignment of learner and corrected sentences, filtering and the train/eval split. This file and
any dialogue built on its sentences are shared under CC BY-SA 4.0.
