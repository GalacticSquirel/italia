from italia_audio.content import collect
from italia_audio.textkey import clip_key


def test_collect_orders_dedupes_and_reads_stories() -> None:
    seed = {
        "lemmas": [{"lemma": "casa", "freqRank": 2}, {"lemma": "il", "freqRank": 1}],
        "sentences": [{"it": "La casa è grande."}, {"it": "Ciao!"}],
    }
    stories = {
        "stories": [
            {
                "title": {"it": "Ciao!"},
                "paragraphs": [{"sentences": [{"it": "Marco  arriva."}]}],
                "questions": [{"prompt": {"it": "Chi arriva?"}, "options": [{"it": "Marco"}]}],
            }
        ]
    }
    out = collect(seed, stories)
    assert [(u.kind, u.text) for u in out] == [
        ("word", "il"),
        ("word", "casa"),
        ("sentence", "La casa è grande."),
        ("sentence", "Ciao!"),
        ("story", "Marco arriva."),
        ("story", "Chi arriva?"),
        ("story", "Marco"),
    ]
    assert out[4].key == clip_key("Marco arriva.")
