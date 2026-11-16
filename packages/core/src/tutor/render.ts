/**
 * The tutor's system prompt and chat messages: a port of
 * `training/spec/render.py`. The phone must send exactly the prompt the model
 * was trained on, so this module is tested against golden cases rendered by
 * the Python spec (`training/spec/generated/render_cases.v1.json`).
 */
import {
  ERROR_TAGS,
  GRAMMAR_POINTS,
  LEVEL_BANDS,
  START_MESSAGE,
  SYSTEM_PROMPT_TEMPLATE,
} from './spec.generated';
import type {
  ChatMessage,
  ErrorTagInfo,
  GrammarPointInfo,
  LevelBand,
  TutorContext,
  TutorLevel,
  TutorOutput,
  TutorTurn,
} from './types';
import { TUTOR_LEVELS } from './types';

const rank = (level: TutorLevel) => TUTOR_LEVELS.indexOf(level);

/** Whether `level` is the same as or below `other`. */
export function levelAtMost(level: TutorLevel, other: TutorLevel): boolean {
  return rank(level) <= rank(other);
}

/** Error tags by id, in taxonomy order. */
export const ERROR_TAG_BY_ID: ReadonlyMap<string, ErrorTagInfo> = new Map(
  ERROR_TAGS.map((t) => [t.id, t]),
);

/** Grammar points by slug, in teaching order. */
export const GRAMMAR_POINT_BY_SLUG: ReadonlyMap<string, GrammarPointInfo> = new Map(
  GRAMMAR_POINTS.map((p) => [p.slug, p]),
);

/** The band for `level`, with the learner's own lemma ceiling if given. */
export function bandFor(level: TutorLevel, lemmaCeiling?: number | null): LevelBand {
  const band = LEVEL_BANDS[level];
  if (lemmaCeiling === undefined || lemmaCeiling === null || lemmaCeiling === band.lemmaCeiling) {
    return band;
  }
  if (lemmaCeiling < 1) throw new Error('lemmaCeiling must be positive');
  return { ...band, lemmaCeiling };
}

/** Grammar points taught at or below `level`, in teaching order. */
export function grammarUpTo(level: TutorLevel): GrammarPointInfo[] {
  return GRAMMAR_POINTS.filter((p) => levelAtMost(p.cefr, level));
}

/** The lowest level at which a learner is expected to attempt a tag's structure. */
export function tagMinLevel(tag: ErrorTagInfo): TutorLevel {
  let min: TutorLevel | null = null;
  for (const slug of tag.grammarPoints) {
    const cefr = GRAMMAR_POINT_BY_SLUG.get(slug)?.cefr;
    if (cefr !== undefined && (min === null || rank(cefr) < rank(min))) min = cefr;
  }
  return min ?? 'A1';
}

/** Error tags a learner at `level` can plausibly produce, in taxonomy order. */
export function tagsForLevel(level: TutorLevel): ErrorTagInfo[] {
  return ERROR_TAGS.filter((t) => levelAtMost(tagMinLevel(t), level));
}

/** The learner's unlocked grammar points, or every point up to their level. */
export function allowedGrammarSlugs(context: TutorContext): string[] {
  const known = context.learner.knownGrammar ?? [];
  if (known.length > 0) {
    const unknown = known.filter((s) => !GRAMMAR_POINT_BY_SLUG.has(s));
    if (unknown.length > 0) throw new Error(`unknown grammar points: ${unknown.join(', ')}`);
    return [...known];
  }
  return grammarUpTo(context.learner.level).map((p) => p.slug);
}

/**
 * Python `string.Template.substitute`: `$name`, `${name}` and `$$`; throws on
 * a missing key or a malformed placeholder.
 */
export function substitute(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(
    /\$(?:(\$)|([_a-z][_a-z0-9]*)|\{([_a-z][_a-z0-9]*)\}|())/gi,
    (_m, escaped: string | undefined, named?: string, braced?: string) => {
      if (escaped !== undefined) return '$';
      const key = named ?? braced;
      if (key === undefined) throw new Error('invalid placeholder in template');
      const value = values[key];
      if (value === undefined) throw new Error(`missing template value: ${key}`);
      return value;
    },
  );
}

/** The system prompt for one conversation (same text as `render_system_prompt`). */
export function renderSystemPrompt(context: TutorContext): string {
  const { learner, scenario } = context;
  const band = bandFor(learner.level, learner.lemmaCeiling);
  const grammar = allowedGrammarSlugs(context)
    .map((s) => GRAMMAR_POINT_BY_SLUG.get(s)?.title ?? s)
    .join('; ');
  const goals = scenario.goals.map((g, i) => `${i + 1}. [${g.id}] ${g.description}`).join('\n');
  const history = learner.errorHistory ?? [];
  const historyBlock =
    history.length === 0
      ? ''
      : `Recurring learner errors (watch for these first): ${history
          .map((h) => {
            const tag = ERROR_TAG_BY_ID.get(h.tag);
            if (!tag) throw new Error(`unknown error tag: ${h.tag}`);
            return `${tag.label} (${h.tag}, ${h.count}x)`;
          })
          .join(', ')}\n`;
  return substitute(SYSTEM_PROMPT_TEMPLATE, {
    level: learner.level,
    tutor_role: scenario.tutorRole,
    setting: scenario.setting,
    learner_role: scenario.learnerRole,
    register_rule:
      scenario.formality === 'formal'
        ? 'Lei (formal) with the learner.'
        : 'tu (informal) with the learner.',
    goals,
    key_vocab: scenario.keyVocab.join(', '),
    english_rule: band.englishAllowed
      ? ' You may add one English word in brackets to explain a new word.'
      : '',
    lemma_ceiling: String(band.lemmaCeiling),
    max_new_words: String(band.maxNewWords),
    max_sentences: String(band.maxSentences),
    max_words: String(band.maxWordsPerSentence),
    grammar,
    history_block: historyBlock,
    error_tags: tagsForLevel(learner.level)
      .map((t) => t.id)
      .join(', '),
  });
}

/**
 * Canonical JSON of a tutor turn, as the model was trained to write it:
 * compact, `reply` first, keys in spec order (Python's
 * `json.dumps(..., ensure_ascii=False, separators=(",", ":"))`).
 */
export function tutorOutputToJson(output: TutorOutput): string {
  const a = output.annotations;
  return JSON.stringify({
    reply: output.reply,
    annotations: {
      prompt:
        a.prompt === null
          ? null
          : { learnerText: a.prompt.learnerText, errorTags: [...a.prompt.errorTags] },
      recast:
        a.recast === null
          ? null
          : {
              learnerText: a.recast.learnerText,
              correctedText: a.recast.correctedText,
              errorTags: [...a.recast.errorTags],
            },
      newWords: a.newWords.map((w) => ({ lemma: w.lemma, glossEn: w.glossEn })),
      scenarioProgress: {
        goalsCompleted: [...a.scenarioProgress.goalsCompleted],
        done: a.scenarioProgress.done,
      },
    },
  });
}

/**
 * System prompt plus the dialogue as chat messages: `[inizio]` opens, tutor
 * turns are their JSON output (same as `render_messages`).
 *
 * @throws Error when the turns do not alternate starting with the tutor
 */
export function renderMessages(
  context: TutorContext,
  turns: readonly TutorTurn[],
  systemPrompt: string = renderSystemPrompt(context),
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: START_MESSAGE },
  ];
  let expected: TutorTurn['role'] = 'tutor';
  for (const turn of turns) {
    if (turn.role !== expected) throw new Error('turns must alternate, starting with the tutor');
    if (turn.role === 'tutor') {
      messages.push({ role: 'assistant', content: tutorOutputToJson(turn.output) });
      expected = 'learner';
    } else {
      messages.push({ role: 'user', content: turn.text });
      expected = 'tutor';
    }
  }
  return messages;
}
