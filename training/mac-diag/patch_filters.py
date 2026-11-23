"""Band/LanguageTool false-positive fixes found in the round-1 pilot. Run from training/.

Pass --tests-only to apply just the new tests (to see them fail first)."""

import sys
from pathlib import Path


def sub(path, old, new):
    p = Path(path)
    s = p.read_text()
    assert s.count(old) == 1, (path, old[:70])
    p.write_text(s.replace(old, new))


TESTS_ONLY = "--tests-only" in sys.argv

# ---------------------------------------------------------------- tests
sub(
    "tests/test_lemmas.py",
    "def test_extract_seed_lemmas(tmp_path: Path) -> None:",
    '''def test_lemmatiser_elided_stems_superlatives_and_adverbs() -> None:
    lemmas = SimplemmaLemmatizer().lemmas
    assert "qualcosa" in lemmas("qualcos")  # qualcos'altro
    assert "venti" in lemmas("vent")  # vent'anni
    assert "bene" in lemmas("benissimo")
    assert "male" in lemmas("malissimo")
    assert "facile" in lemmas("facilmente")
    assert "veloce" in lemmas("velocemente")
    assert "lento" in lemmas("lentamente")
    checker = BandChecker(default_lemma_list(), SimplemmaLemmatizer())
    report = checker.check("Vuoi qualcos'altro? Benissimo, parli facilmente.", BANDS[Level.A2])
    assert report.ratio == 0, report.out_of_band


def test_extract_seed_lemmas(tmp_path: Path) -> None:''',
)

sub(
    "tests/test_filters_dedupe.py",
    "def test_parse_tutor_output_is_strict() -> None:",
    '''class FlagWords:
    """Flags every occurrence of the given words, like LanguageTool on a misspelling."""

    def __init__(self, *words: str) -> None:
        self.words = words

    def check(self, text: str) -> list[GrammarMatch]:
        out = []
        for word in self.words:
            start = text.lower().find(word.lower())
            while start != -1:
                out.append(GrammarMatch("X", "TYPOS", "typo", start, len(word)))
                start = text.lower().find(word.lower(), start + 1)
        return out


def quoting_record() -> DialogueRecord:
    """The tutor prompts on a non-word the learner just said, repeating it as a question."""
    record = make_record()
    tag = record.turns[2].output.annotations.error_tags[0]  # type: ignore[union-attr]
    turns = list(record.turns)
    turns[1] = Turn.learner("Domani andarò al bar.")
    turns[2] = Turn.tutor(output("Andarò? Come si dice?", prompt=("andarò", [tag])))
    return record.model_copy(update={"turns": turns})


def test_quoted_learner_error_is_not_counted_against_the_tutor() -> None:
    assert run(quoting_record(), grammar=FlagWords("andarò")) == []


def test_tutor_own_errors_still_count_next_to_a_quote() -> None:
    record = quoting_record()
    turns = list(record.turns)
    old = turns[2].output
    assert old is not None
    turns[2] = Turn.tutor(old.model_copy(update={"reply": "Andarò? Come si dice? Sbaglio sbaglio."}))
    bad = record.model_copy(update={"turns": turns})
    reasons = run(bad, grammar=FlagWords("andarò", "sbaglio"), max_lt_errors_per_100_words=0)
    assert any("LanguageTool" in r for r in reasons)


def test_parse_tutor_output_is_strict() -> None:''',
)

if TESTS_ONLY:
    print("tests applied")
    sys.exit(0)

# ---------------------------------------------------------------- lemmas
sub(
    "datagen/lemmas.py",
    '    "po": "poco",\n}\n',
    '    "po": "poco",\n'
    "    # elided stems that tokenize() leaves behind (qualcos'altro, vent'anni, nient'altro)\n"
    '    "qualcos": "qualcosa",\n'
    '    "nient": "niente",\n'
    '    "tutt": "tutto",\n'
    '    "vent": "venti",\n'
    '    "trent": "trenta",\n'
    '    "quarant": "quaranta",\n'
    '    "cinquant": "cinquanta",\n'
    '    "sessant": "sessanta",\n'
    '    "settant": "settanta",\n'
    '    "ottant": "ottanta",\n'
    '    "novant": "novanta",\n'
    "    # superlatives of adverbs (the -issimo rule would give beno, malo)\n"
    '    "benissimo": "bene",\n'
    '    "malissimo": "male",\n'
    "}\n",
)
sub(
    "datagen/lemmas.py",
    "        if len(word) > 4 and word[-1] in \"aie\":  # vista -> visto -> vedere\n",
    "        if word.endswith(\"mente\") and len(word) > 8:  # adverbs -> adjective\n"
    "            stem = word[:-5]\n"
    "            if stem.endswith(\"a\"):  # lentamente -> lento\n"
    "                candidates.append(lemma(stem[:-1] + \"o\"))\n"
    "            elif stem.endswith((\"l\", \"r\")):  # facilmente -> facile\n"
    "                candidates.append(stem + \"e\")\n"
    "            else:  # velocemente -> veloce\n"
    "                candidates.append(stem)\n"
    "        if len(word) > 4 and word[-1] in \"aie\":  # vista -> visto -> vedere\n",
)

# ---------------------------------------------------------------- languagetool
sub(
    "datagen/languagetool.py",
    'def errors_per_100_words(checker: GrammarChecker, texts: list[str]) -> float:\n'
    '    """LanguageTool matches per 100 words over `texts` (0 for no words)."""\n'
    "    words = sum(len(tokenize(t)) for t in texts)\n"
    "    if words == 0:\n"
    "        return 0.0\n"
    "    errors = sum(len(checker.check(t)) for t in texts)\n"
    "    return 100.0 * errors / words\n",
    "def errors_per_100_words(\n"
    "    checker: GrammarChecker,\n"
    "    texts: list[str],\n"
    "    quoted: list[list[str]] | None = None,\n"
    ") -> float:\n"
    '    """LanguageTool matches per 100 words over `texts` (0 for no words).\n'
    "\n"
    "    `quoted[i]` lists spans that text i repeats from the learner on purpose (a prompt echoes the\n"
    "    learner's wrong form); matches inside them are the learner's errors, not the text's.\n"
    '    """\n'
    "    words = sum(len(tokenize(t)) for t in texts)\n"
    "    if words == 0:\n"
    "        return 0.0\n"
    "    errors = 0\n"
    "    for index, text in enumerate(texts):\n"
    "        spans = [s.lower() for s in (quoted[index] if quoted else []) if s.strip()]\n"
    "        for match in checker.check(text):\n"
    "            flagged = match.span(text).lower()\n"
    "            if not (flagged and any(flagged in span for span in spans)):\n"
    "                errors += 1\n"
    "    return 100.0 * errors / words\n",
)

# ---------------------------------------------------------------- filters
sub(
    "datagen/filters.py",
    "    allowed = [*scenario.key_vocab, *(w.lemma for w in ann.new_words)]\n",
    "    # Words the learner just used are known to them, and a prompt must echo the wrong form.\n"
    "    allowed = [\n"
    "        *scenario.key_vocab,\n"
    "        *(w.lemma for w in ann.new_words),\n"
    "        *([previous_learner] if previous_learner else []),\n"
    "    ]\n",
)
sub(
    "datagen/filters.py",
    "    replies: list[str] = []\n    corrections: list[str] = []\n",
    "    replies: list[str] = []\n    quoted: list[list[str]] = []\n    corrections: list[str] = []\n",
)
sub(
    "datagen/filters.py",
    "        replies.append(turn.output.reply)\n",
    "        replies.append(turn.output.reply)\n"
    "        feedback = (turn.output.annotations.prompt, turn.output.annotations.recast)\n"
    "        quoted.append([f.learner_text for f in feedback if f is not None])\n",
)
sub(
    "datagen/filters.py",
    "    lt_rate = errors_per_100_words(grammar, replies)\n",
    "    lt_rate = errors_per_100_words(grammar, replies, quoted)\n",
)
print("patched")
