"""Per-turn grammar check for the dialogue judge.

The 7-criterion rubric asks the judge for a 1-5 grammaticality number over a whole dialogue. On
round 1 the local judges (Qwen3-Next-80B, Llama-3.3-70B) gave every accepted dialogue a 5 and
missed planted mistakes such as "ci sono un balcone" and "ho andato". Checking one tutor turn at
a time, asking for the wrong words themselves, and confirming each one separately works much
better. Measured with Qwen3-Next-80B on 6 planted errors and 20 unseen accepted dialogues
(128 tutor turns): 5 of 6 planted errors caught, and about 4% of clean turns falsely flagged.
It still misses a preposition that belongs before an interrogative ("A quale fermata"), and it
flags several real mistakes in accepted round-1 dialogues (gender agreement with the learner,
"con alta sedia", "Dicesse per favore").

For every tutor turn:
1. find: the judge lists definite mistakes as {quote, fix}, given the scene, the register (tu or
   Lei), the learner's gender, and what the learner has said so far;
2. clean up deterministically: drop quotes that are not in the reply, that repeat the learner
   (a prompt deliberately echoes the learner's mistake, and the turn's prompt/recast annotation
   names the span), that sit inside quotation marks (a mention such as Non si dice 'la arancia'),
   or whose fix changes nothing;
3. verify: each remaining flag is put back to the judge as a yes/no question, "definitely wrong,
   not just phrased differently?".

grammaticality is then scored from the confirmed list (see `grammaticality_score`).
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from typing import Any

from datagen.jsonutil import JsonExtractError, extract_json_object
from datagen.quotes import quoted_spans
from datagen.records import DialogueRecord, GrammarError
from datagen.teacher import ChatClient, Usage

FIND_PROMPT = """\
You are a strict native Italian proofreader checking one reply written by an Italian tutor in a
role-play lesson.

Scene: {setting} The tutor plays {tutor_role}; the learner plays {learner_role}.
Register: {register}
The learner is {gender}: adjectives and participles that refer to the learner must be {form}.

What the learner has said so far (may contain mistakes; ignore them):
<learner>{learner}</learner>

Tutor's reply to check:
<reply>{reply}</reply>

List only definite mistakes in the tutor's reply, things a native speaker would call wrong in any
context: grammar, agreement, verb forms, auxiliary (essere/avere), missing or wrong prepositions or
articles, spelling, accents and apostrophes.
Do NOT list:
- text the tutor repeats from the learner (a prompt deliberately echoes the learner's mistake);
- the choice of tu or Lei (the register above is required);
- more natural, more formal or alternative wordings of something that is already correct;
- agreement with people other than the learner whose gender the reply does not show.

Answer with JSON only:
{{"errors": [{{"quote": "<exact wrong text from the reply>", "fix": "<corrected text>"}}]}}
Use {{"errors": []}} when the reply has no definite mistakes."""

VERIFY_PROMPT = """\
A proofreader claims there is a mistake in this Italian sentence, written by a tutor in a
role-play lesson ({register}; the learner is {gender}).

Sentence: <s>{reply}</s>
Claimed mistake: "{quote}"  ->  suggested: "{fix}"

Is the original text definitely wrong in standard Italian (ungrammatical, wrong agreement or verb
form, wrong auxiliary or preposition, misspelled), so that a native speaker would correct it in
any context? Answer "false" if it is correct but could be phrased differently, if it repeats a
learner's words on purpose, or if it is only a tu/Lei or style choice.

Answer with JSON only: {{"definitelyWrong": true}} or {{"definitelyWrong": false}}"""

FIND_MAX_TOKENS = 400
VERIFY_MAX_TOKENS = 40


# A single-, double- or guillemet-quoted span, e.g. 'la arancia' or "ho visto lo". Single quotes
# must open after a space or line start and close before punctuation or a space, so elisions
# such as l'ho do not end a span.
class CheckParseError(ValueError):
    """A judge answer the checks could not read, even after one retry."""


GrammarCheckError = CheckParseError  # the name this module first had


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower().replace("\u2019", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]", " ", text)).strip()


def word_set(text: str) -> set[str]:
    # keep elisions (l'arancia) but not quote marks around a word ('la arancia')
    return {w.strip("'") for w in normalize(text).split()} - {""}


def keep_flag(
    quote: str,
    fix: str,
    *,
    reply: str,
    learner_turns: Sequence[str],
    annotated_spans: Sequence[str],
) -> bool:
    """Whether a flag survives the deterministic cleanup (step 2 in the module docstring)."""
    q = normalize(quote)
    if not q or q not in normalize(reply):
        return False  # not in the reply
    if q == normalize(fix):
        return False  # the "correction" changes nothing
    if any(q in normalize(t) for t in learner_turns):
        return False  # repeats the learner word for word
    words = word_set(quote)
    for span in annotated_spans:  # the turn's own prompt/recast says it echoes this span
        if len(words & word_set(span)) >= max(1, len(words) // 2):
            return False
    return not any(words & word_set(span) for span in quoted_spans(reply))


def grammaticality_score(n_errors: int) -> float:
    """5 for a clean dialogue; one confirmed mistake is 3, below the default floor of 4."""
    return {0: 5.0, 1: 3.0, 2: 2.0}.get(n_errors, 1.0)


def scene(record: DialogueRecord) -> dict[str, str]:
    scenario = record.context.scenario
    female = record.persona.gender == "f"
    return {
        "setting": scenario.setting,
        "tutor_role": scenario.tutor_role,
        "learner_role": scenario.learner_role,
        "register": (
            "formal: the tutor addresses the learner with Lei"
            if scenario.formality == "formal"
            else "informal: the tutor addresses the learner with tu"
        ),
        "gender": "female" if female else "male",
        "form": "feminine" if female else "masculine",
    }


RETRY_TEMPERATURE = 0.7
RETRY_NOTE = (
    "\n\nYour previous answer was not valid JSON ({problem}). Answer again with one valid JSON "
    "object only: plain strings in double quotes, no arrows, comments or text outside it."
)


def ask_json(
    client: ChatClient,
    prompt: str,
    *,
    max_tokens: int,
    what: str,
    required: str,
    kind: type = list,
) -> tuple[dict[str, Any], Usage]:
    """Ask for a JSON object whose `required` key holds a `kind`. A reply without one gets a
    single retry at RETRY_TEMPERATURE that says what was wrong: at temperature 0 the same prompt
    gives the same unusable answer every time (round 1 had one dialogue that could never be
    judged; another answered "correctForm": "a" -> "b")."""
    usage = Usage()
    problem = ""
    for temperature in (0.0, RETRY_TEMPERATURE):
        text = prompt if not problem else prompt + RETRY_NOTE.format(problem=problem)
        completion = client.complete(
            [{"role": "user", "content": text}],
            temperature=temperature,
            max_tokens=max_tokens,
            json_output=True,
        )
        usage = usage + completion.usage
        try:
            raw = extract_json_object(completion.text)
        except JsonExtractError as err:
            problem = str(err)
            continue
        if isinstance(raw.get(required), kind):
            return raw, usage
        problem = f"'{required}' is not a {kind.__name__}"
    raise CheckParseError(f"{what}: {problem}")


def _find(client: ChatClient, prompt: str) -> tuple[list[tuple[str, str]], Usage]:
    answer, usage = ask_json(
        client, prompt, max_tokens=FIND_MAX_TOKENS, what="grammar check", required="errors"
    )
    raw = answer["errors"]
    flags = [
        (str(item.get("quote", "")), str(item.get("fix", "")))
        for item in raw
        if isinstance(item, dict)
    ]
    return flags, usage


def _confirmed(client: ChatClient, prompt: str) -> tuple[bool, Usage]:
    completion = client.complete(
        [{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=VERIFY_MAX_TOKENS,
        json_output=True,
    )
    try:
        answer = extract_json_object(completion.text).get("definitelyWrong", True)
    except JsonExtractError:
        answer = True  # an unreadable verdict keeps the flag
    return answer is not False, completion.usage


def check_dialogue(record: DialogueRecord, client: ChatClient) -> tuple[list[GrammarError], Usage]:
    """Confirmed grammar mistakes in the tutor's turns, with the judge usage they cost."""
    ctx = scene(record)
    usage = Usage()
    errors: list[GrammarError] = []
    learner_so_far: list[str] = []
    for index, turn in enumerate(record.turns):
        if turn.output is None:
            learner_so_far.append(turn.text)
            continue
        reply = turn.output.reply
        ann = turn.output.annotations
        annotated = [f.learner_text for f in (ann.prompt, ann.recast) if f is not None]
        flags, cost = _find(
            client,
            FIND_PROMPT.format(
                **ctx, learner="\n".join(learner_so_far) or "(nothing yet)", reply=reply
            ),
        )
        usage = usage + cost
        for quote, fix in flags:
            if not keep_flag(
                quote,
                fix,
                reply=reply,
                learner_turns=learner_so_far,
                annotated_spans=annotated,
            ):
                continue
            ok, cost = _confirmed(
                client,
                VERIFY_PROMPT.format(
                    register=ctx["register"].split(":")[0],
                    gender=ctx["gender"],
                    reply=reply,
                    quote=quote,
                    fix=fix,
                ),
            )
            usage = usage + cost
            if ok:
                errors.append(GrammarError(turn=index, quote=quote, fix=fix))
    return errors, usage
