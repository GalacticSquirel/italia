from italia_audio.align import words


def test_words_spell_for_the_aligner() -> None:
    text = "«L'ho visto», dice Niccolò: 3 volte!"
    assert [(text[s:e], w) for s, e, w in words(text)] == [
        ("L'ho", "l'ho"),
        ("visto", "visto"),
        ("dice", "dice"),
        ("Niccolò", "niccolo"),
        ("volte", "volte"),
    ]
