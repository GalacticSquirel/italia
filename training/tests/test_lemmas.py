from __future__ import annotations

from pathlib import Path

from datagen.lemmas import (
    BandChecker,
    LemmaList,
    SimplemmaLemmatizer,
    default_lemma_list,
    extract_seed_lemmas,
    split_sentences,
    tokenize,
    words_per_sentence,
)
from spec.levels import BANDS, Level


class DictLemmatizer:
    def __init__(self, table: dict[str, str]) -> None:
        self.table = table

    def lemmas(self, word: str) -> list[str]:
        return list(dict.fromkeys([word, self.table.get(word, word)]))


def test_tokenize_splits_elisions_and_keeps_numbers() -> None:
    assert tokenize("L'acqua c\u2019è, 3,50 euro!") == ["L", "acqua", "c", "è", "3,50", "euro"]


def test_sentences_and_lengths() -> None:
    text = "Buongiorno! Cosa prende oggi? Un caffè."
    assert split_sentences(text) == ["Buongiorno!", "Cosa prende oggi?", "Un caffè."]
    assert words_per_sentence(text) == [1, 3, 2]


def test_band_checker_with_small_list() -> None:
    lemma_list = LemmaList({"essere": 2, "casa": 40, "grande": 90, "balcone": 2500})
    checker = BandChecker(lemma_list, DictLemmatizer({"è": "essere", "case": "casa"}))
    band = BANDS[Level.A1]
    report = checker.check("La casa è grande e ha un balcone.", band)
    # "ha" is not in the toy list and "balcone" is above the A1 ceiling.
    assert [o.token for o in report.out_of_band] == ["ha", "balcone"]
    assert report.content_tokens == 5
    allowed = checker.check("La casa è grande e ha un balcone.", band, allowed=["balcone", "ha"])
    assert allowed.out_of_band == []


def test_band_checker_skips_names_numbers_and_closed_class() -> None:
    checker = BandChecker(LemmaList({"andare": 50}), DictLemmatizer({"va": "andare"}))
    report = checker.check("Marta va a Roma alle 8.", BANDS[Level.A1])
    assert report.out_of_band == []
    assert report.content_tokens == 1


def test_real_list_and_lemmatiser() -> None:
    checker = BandChecker(default_lemma_list(), SimplemmaLemmatizer())
    a1 = BANDS[Level.A1]
    easy = checker.check("Siamo andati a casa e abbiamo mangiato.", a1)
    assert easy.ratio == 0
    hard = checker.check("La caparra comprende due mensilità.", a1)
    assert {o.token for o in hard.out_of_band} >= {"caparra", "mensilità"}
    clitic = checker.check("Voglio mangiarlo.", a1)
    assert clitic.ratio == 0


def test_extract_seed_lemmas(tmp_path: Path) -> None:
    seed = tmp_path / "seed.json"
    seed.write_text(
        '{"lemmas": [{"lemma": "essere", "pos": "VERB", "freqRank": 2},'
        ' {"lemma": "il", "pos": "DET", "freqRank": 1}]}',
        encoding="utf-8",
    )
    out = tmp_path / "lemmas.tsv"
    assert extract_seed_lemmas(seed, out) == 2
    assert out.read_text().splitlines() == ["rank\tlemma\tpos", "1\til\tDET", "2\tessere\tVERB"]
    assert LemmaList.load(out).rank("essere") == 2


def test_core_vocab_overrides_subtitle_ranks() -> None:
    lemma_list = default_lemma_list()
    rank = lemma_list.rank("lunedì")
    assert rank is not None and rank <= BANDS[Level.A1].lemma_ceiling
    assert lemma_list.rank("grande") == 1  # missing from the seed list entirely


def test_every_scenario_opening_fits_its_lowest_level() -> None:
    from spec.levels import band_for
    from spec.scenarios import load_library

    checker = BandChecker(default_lemma_list(), SimplemmaLemmatizer())
    for scenario in load_library().values():
        level = min(scenario.levels, key=lambda lv: lv.rank)
        band = band_for(level)
        report = checker.check(scenario.opening, band, scenario.key_vocab)
        assert report.out_of_band == [], (scenario.id, report.out_of_band)
