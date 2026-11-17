# data

`lemmas.seed-v1.tsv`: the 10,000 most frequent Italian lemmas (rank, lemma, universal POS) from
the content seed (`packages/content/seed/seed.v1.json`, seed version 1). The vocabulary-band
checker uses the ranks as each level's known-lemma ceiling.

Regenerate it after a new seed build:

```sh
uv run python -m datagen lemmas --seed ../packages/content/seed/seed.v1.json
```

Licence: the lemma ranks are derived from FrequencyWords (CC BY-SA 4.0) and Morph-it! (CC BY-SA
2.0), so this file is a CC BY-SA derivative; see `packages/content/LICENSES.md`.
