from italia_audio.native import Recording, choose, parse_title


def test_parse_title() -> None:
    rec = parse_title("File:LL-Q652 (ita)-LangPao-Perché.wav")
    assert rec is not None and (rec.speaker, rec.word) == ("LangPao", "perché")
    assert parse_title("File:LL-Q150 (fra)-X-chat.wav") is None


def test_choose_prefers_prolific_speakers_one_clip_each() -> None:
    recs = [
        Recording("t1", "A", "casa"),
        Recording("t2", "A", "casa"),
        Recording("t3", "B", "casa"),
        Recording("t4", "B", "cane"),
        Recording("t5", "C", "casa"),
        Recording("t6", "B", "gatto"),
        Recording("t7", "Z", "altro"),
    ]
    chosen = choose(recs, {"casa", "cane"}, per_word=2)
    assert [(r.word, r.speaker) for r in chosen] == [("cane", "B"), ("casa", "A"), ("casa", "B")]
