from pathlib import Path


def sub(path, old, new):
    p = Path(path)
    s = p.read_text()
    assert s.count(old) == 1, (path, old[:60])
    p.write_text(s.replace(old, new))


sub(
    "datagen/config.py",
    '    revise_pass: bool = Field(default=True, description="Second teacher pass: critique and fix.")\n',
    '    revise_pass: bool = Field(default=True, description="Second teacher pass: critique and fix.")\n'
    "    draft_repairs: int = Field(\n"
    "        default=1,\n"
    "        ge=0,\n"
    "        description=\"Follow-up turns that send a draft's validation error back to the teacher.\",\n"
    "    )\n",
)

sub(
    "datagen/synthesis.py",
    "def _plan_line(",
    '_REPAIR_INSTRUCTIONS = """\\\n'
    "Your JSON failed validation: {error}\n"
    "\n"
    "The plan has exactly {n_learner} learner turns, so the dialogue must have exactly {n_total} turns,\n"
    "alternating tutor, learner, tutor, ..., tutor ({n_tutor} tutor turns), and must follow the plan\n"
    "line by line: Tutor turn 1, Learner turn 1, Tutor turn 2, and so on. Every tutor output must\n"
    "follow the JSON Schema. Fix the problem with the smallest possible change and return the full\n"
    "dialogue as JSON in the same shape, and nothing else.\n"
    '"""\n'
    "\n"
    "\n"
    "def _plan_line(",
)

sub(
    "datagen/synthesis.py",
    "    usage: Usage = completion.usage\n"
    "    turns = parse_dialogue(completion.text, len(plan))\n",
    "    usage: Usage = completion.usage\n"
    "    for repair in range(config.draft_repairs + 1):\n"
    "        try:\n"
    "            turns = parse_dialogue(completion.text, len(plan))\n"
    "            break\n"
    "        except SynthesisError as err:\n"
    "            if repair == config.draft_repairs:\n"
    "                raise\n"
    "            # Local teachers often add or drop one exchange; showing them the error is far\n"
    "            # cheaper than a fresh draft (the brief is already in the conversation).\n"
    "            messages = [\n"
    "                *messages,\n"
    '                {"role": "assistant", "content": completion.text},\n'
    "                {\n"
    '                    "role": "user",\n'
    '                    "content": _REPAIR_INSTRUCTIONS.format(\n'
    "                        error=err,\n"
    "                        n_learner=len(plan),\n"
    "                        n_tutor=len(plan) + 1,\n"
    "                        n_total=2 * len(plan) + 1,\n"
    "                    ),\n"
    "                },\n"
    "            ]\n"
    "            completion = teacher.complete(\n"
    "                messages,\n"
    "                temperature=config.teacher_temperature,\n"
    "                max_tokens=config.teacher_max_tokens,\n"
    "                json_output=True,\n"
    "            )\n"
    "            usage = usage + completion.usage\n",
)

sub(
    "tests/test_learner_synthesis.py",
    "def test_synthesize_with_revise_pass() -> None:",
    '''def test_synthesize_repairs_a_miscounted_draft() -> None:
    config = make_config(revisePass=False)
    scenarios = [s for s in load_library().values() if s.split == "train"]
    job = build_jobs(config, scenarios)[0]
    scenario = load_library()[job.scenario_id]
    _, _, plan = prepare(job, scenario, config)
    good = plan_following_turns(plan, scenario.opening)
    short = dialogue_json(good[:-2])  # one exchange missing
    teacher = ScriptedClient([short, dialogue_json(good)])
    record = synthesize(job, scenario, config, teacher)
    assert len(teacher.calls) == 2 and len(record.learner_turns()) == len(plan)
    repair = teacher.calls[1]
    assert [m["role"] for m in repair] == ["user", "assistant", "user"]
    assert repair[1]["content"] == short
    assert "alternating" in repair[2]["content"]
    assert f"exactly {2 * len(plan) + 1} turns" in repair[2]["content"]


def test_synthesize_gives_up_after_draft_repairs() -> None:
    config = make_config(revisePass=False, draftRepairs=1)
    scenarios = [s for s in load_library().values() if s.split == "train"]
    job = build_jobs(config, scenarios)[0]
    scenario = load_library()[job.scenario_id]
    teacher = ScriptedClient(["sorry"])
    with pytest.raises(SynthesisError):
        synthesize(job, scenario, config, teacher)
    assert len(teacher.calls) == 2


def test_synthesize_with_revise_pass() -> None:''',
)
print("patched")
