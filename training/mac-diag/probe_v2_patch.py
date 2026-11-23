import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)


sub('Use {{"errors": []}} when the reply has no mistakes."""\n',
'''Use {{"errors": []}} when the reply has no mistakes."""

PROMPT_V2 = """You are a strict native Italian proofreader checking one reply written by an Italian
tutor in a role-play lesson.

Scene: {setting} The tutor plays {tutor_role}; the learner plays {learner_role}.
Register: {register}
The learner is {gender}: adjectives and participles that refer to the learner must be {gender_form}.

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
''')
sub("N_CLEAN = 20\n",
    "N_CLEAN = 20\nV2 = \"--v2\" in sys.argv\n"
    "START = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--start=')), 10))\n")
sub('''    for k, text in enumerate(PLANTED):
        rec = DialogueRecord.model_validate(rows[k])
        i = max(j for j, t in enumerate(rec.turns) if t.output is not None)
        learner = rec.turns[i - 1].text if i > 0 and rec.turns[i - 1].output is None else ""
        items.append({"kind": "planted", "case": k, "dialogue": rec.id, "turn": i,
                      "reply": text, "learner": learner or ""})
    for rec in (DialogueRecord.model_validate(r) for r in rows[10 : 10 + N_CLEAN]):
        for i, t in enumerate(rec.turns):
            if t.output is None:
                continue
            learner = rec.turns[i - 1].text if i > 0 and rec.turns[i - 1].output is None else ""
            items.append({"kind": "clean", "dialogue": rec.id, "turn": i,
                          "reply": t.output.reply, "learner": learner or ""})
''', '''    def item(kind: str, rec: DialogueRecord, i: int, reply: str, **extra: object) -> dict:
        prev = rec.turns[i - 1].text if i > 0 and rec.turns[i - 1].output is None else ""
        so_far = [t.text or "" for t in rec.turns[:i] if t.output is None]
        sc = rec.context.scenario
        return {"kind": kind, "dialogue": rec.id, "turn": i, "reply": reply,
                "learner": prev or "", "learner_all": so_far, **extra,
                "ctx": {"setting": sc.setting, "tutor_role": sc.tutor_role,
                        "learner_role": sc.learner_role, "formality": sc.formality,
                        "gender": rec.persona.gender}}

    for k, text in enumerate(PLANTED):
        rec = DialogueRecord.model_validate(rows[k])
        i = max(j for j, t in enumerate(rec.turns) if t.output is not None)
        items.append(item("planted", rec, i, text, case=k))
    for rec in (DialogueRecord.model_validate(r) for r in rows[START : START + N_CLEAN]):
        for i, t in enumerate(rec.turns):
            if t.output is not None:
                items.append(item("clean", rec, i, t.output.reply))
''')
sub('''        c = client.complete(
            [{"role": "user", "content": PROMPT.format(learner=item["learner"] or "(none)",
                                                       reply=item["reply"])}],
''', '''        if V2:
            ctx = item["ctx"]
            content = PROMPT_V2.format(
                setting=ctx["setting"], tutor_role=ctx["tutor_role"],
                learner_role=ctx["learner_role"],
                register=("formal: the tutor addresses the learner with Lei"
                          if ctx["formality"] == "formal"
                          else "informal: the tutor addresses the learner with tu"),
                gender="female" if ctx["gender"] == "f" else "male",
                gender_form="feminine" if ctx["gender"] == "f" else "masculine",
                learner="\\n".join(item["learner_all"]) or "(nothing yet)",
                reply=item["reply"])
        else:
            content = PROMPT.format(learner=item["learner"] or "(none)", reply=item["reply"])
        c = client.complete(
            [{"role": "user", "content": content}],
''')
sub('''                "flags": cleanup(raw, item["reply"], item["learner"]), "lt": lt_spans}''',
    '''                "flags": cleanup(raw, item["reply"],
                                 " || ".join(item["learner_all"]) if V2 else item["learner"]),
                "lt": lt_spans}''')
p.write_text(s, encoding="utf-8")
print("patched")
