/**
 * Guard rails on the model's annotations before the app shows or stores
 * them. A small model will sometimes "correct" text that was right, tag an
 * error with a tag that does not exist, or quote words the learner never
 * wrote. Each check below drops the offending annotation (never the reply),
 * and says why, so a wrong correction is never shown or turned into a review.
 */
import type { LearnerError } from '../providers';
import { bandFor, ERROR_TAG_BY_ID } from './render';
import type {
  NewWord,
  TutorContext,
  TutorOutput,
  TutorPrompt,
  TutorRecast,
  TutorScenario,
} from './types';

/** What the checks need besides the output. */
export interface PostValidateInput {
  context: TutorContext;
  /** The learner message this turn answers, or null for the opening turn. */
  learnerText: string | null;
  /** Goals completed before this turn (progress is cumulative). */
  previousGoals?: readonly string[];
}

/** Result of {@link postValidate}. */
export interface PostValidated {
  output: TutorOutput;
  /** One line per dropped annotation, for logs and tests. */
  dropped: string[];
}

const EDGE_PUNCTUATION = /^[\s.,!?;:«»"“”()-]+|[\s.,!?;:«»"“”()-]+$/gu;

/** Lowercase, unify apostrophes, collapse spaces, strip edge punctuation. */
export function normaliseItalian(text: string): string {
  return text
    .toLocaleLowerCase('it')
    .replace(/[’‘`´]/gu, "'")
    .replace(/\s+/gu, ' ')
    .replace(EDGE_PUNCTUATION, '');
}

/** Letters (any script), apostrophes, spaces and ordinary punctuation only. */
const PLAUSIBLE_TEXT = /^[\p{L}\p{M}0-9'’\s.,!?;:«»"“”()-]+$/u;

function cleanTags(tags: readonly string[]): string[] {
  return [...new Set(tags)].filter((t) => ERROR_TAG_BY_ID.has(t)).slice(0, 2);
}

const APOSTROPHES = "['’‘`´]";
const WORD_CHAR = '[\\p{L}\\p{M}\\p{N}]';

/**
 * Where `span` occurs in `message` as whole words, matching the way
 * {@link normaliseItalian} compares text (any case, any apostrophe, any run
 * of spaces, edge punctuation ignored), as an offset and length into the
 * original `message`. Null when it does not occur.
 */
export function findSpan(span: string, message: string): { index: number; length: number } | null {
  const s = normaliseItalian(span);
  if (s.length === 0) return null;
  const body = Array.from(s)
    .map((ch) => {
      if (ch === "'") return APOSTROPHES;
      if (ch === ' ') return '\\s+';
      return ch.replace(/[.*+?^${}()|[\]\\/-]/gu, '\\$&');
    })
    .join('');
  // A span may start or end inside an elided word ("dell'"), so the
  // boundary is only required next to a letter of the span itself.
  const start = s.startsWith("'") ? '' : `(?<!${WORD_CHAR})`;
  const end = s.endsWith("'") ? '' : `(?!${WORD_CHAR})`;
  const match = new RegExp(`${start}${body}${end}`, 'iu').exec(message);
  return match === null ? null : { index: match.index, length: match[0].length };
}

/** Whether `span` occurs in `message` as whole words (after normalising both). */
export function spanInMessage(span: string, message: string): boolean {
  return findSpan(span, message) !== null;
}

function checkPrompt(
  prompt: TutorPrompt,
  learnerText: string | null,
  dropped: string[],
): TutorPrompt | null {
  if (learnerText === null) {
    dropped.push('prompt: there is no learner message to correct');
    return null;
  }
  const tags = cleanTags(prompt.errorTags);
  if (tags.length === 0) {
    dropped.push(`prompt: no known error tag in ${prompt.errorTags.join(', ')}`);
    return null;
  }
  if (!spanInMessage(prompt.learnerText, learnerText)) {
    dropped.push(`prompt: "${prompt.learnerText}" is not in the learner's message`);
    return null;
  }
  return { learnerText: prompt.learnerText, errorTags: tags };
}

function checkRecast(
  recast: TutorRecast,
  learnerText: string | null,
  dropped: string[],
): TutorRecast | null {
  if (learnerText === null) {
    dropped.push('recast: there is no learner message to correct');
    return null;
  }
  const tags = cleanTags(recast.errorTags);
  if (tags.length === 0) {
    dropped.push(`recast: no known error tag in ${recast.errorTags.join(', ')}`);
    return null;
  }
  if (!spanInMessage(recast.learnerText, learnerText)) {
    dropped.push(`recast: "${recast.learnerText}" is not in the learner's message`);
    return null;
  }
  const wrong = normaliseItalian(recast.learnerText);
  const right = normaliseItalian(recast.correctedText);
  if (wrong === right) {
    dropped.push('recast: the corrected text is the same as the learner text');
    return null;
  }
  if (!PLAUSIBLE_TEXT.test(recast.correctedText)) {
    dropped.push('recast: the corrected text has characters Italian text does not use');
    return null;
  }
  const words = (s: string) => s.split(' ').filter((w) => w.length > 0).length;
  if (words(right) > 2 * words(wrong) + 4) {
    dropped.push('recast: the corrected text rewrites far more than the learner text');
    return null;
  }
  return { learnerText: recast.learnerText, correctedText: recast.correctedText, errorTags: tags };
}

function checkNewWords(words: readonly NewWord[], max: number, dropped: string[]): NewWord[] {
  const seen = new Set<string>();
  const out: NewWord[] = [];
  for (const w of words) {
    const lemma = normaliseItalian(w.lemma);
    if (lemma.length === 0 || lemma.split(' ').length > 3 || seen.has(lemma)) {
      dropped.push(`newWords: "${w.lemma}" is not a word`);
      continue;
    }
    if (out.length >= max) {
      dropped.push(`newWords: "${w.lemma}" is over the level's limit of ${max}`);
      continue;
    }
    seen.add(lemma);
    out.push({ lemma: w.lemma.trim(), glossEn: w.glossEn.trim() });
  }
  return out;
}

function checkGoals(
  goals: readonly string[],
  previous: readonly string[],
  scenario: TutorScenario,
  dropped: string[],
): string[] {
  const done = new Set(previous);
  for (const g of goals) {
    if (scenario.goals.some((s) => s.id === g)) done.add(g);
    else dropped.push(`scenarioProgress: unknown goal ${g}`);
  }
  // Scenario order, so progress reads naturally.
  return scenario.goals.map((g) => g.id).filter((id) => done.has(id));
}

/**
 * Check a parsed tutor turn and drop invalid annotations:
 *
 * - a turn carries a prompt or a recast, not both (the recast wins)
 * - no correction on the opening turn
 * - error tags must be in the taxonomy (at most 2, no repeats)
 * - the quoted learner text must occur in the learner's message
 * - a recast's corrected text must differ from the learner text, look like
 *   Italian, and not rewrite far more than the quoted span
 * - new words within the level's limit, without repeats
 * - completed goals must be the scenario's; progress is cumulative
 */
export function postValidate(output: TutorOutput, input: PostValidateInput): PostValidated {
  const dropped: string[] = [];
  const { context, learnerText } = input;
  const a = output.annotations;
  let promptIn = a.prompt;
  if (a.prompt !== null && a.recast !== null) {
    dropped.push('prompt: a turn has a prompt or a recast, not both');
    promptIn = null;
  }
  const recast = a.recast === null ? null : checkRecast(a.recast, learnerText, dropped);
  const prompt = promptIn === null ? null : checkPrompt(promptIn, learnerText, dropped);
  const band = bandFor(context.learner.level, context.learner.lemmaCeiling);
  return {
    output: {
      reply: output.reply.trim(),
      annotations: {
        prompt,
        recast,
        newWords: checkNewWords(a.newWords, band.maxNewWords, dropped),
        scenarioProgress: {
          goalsCompleted: checkGoals(
            a.scenarioProgress.goalsCompleted,
            input.previousGoals ?? [],
            context.scenario,
            dropped,
          ),
          done: a.scenarioProgress.done,
        },
      },
    },
    dropped,
  };
}

/**
 * The learner's whole message with a recast's span corrected, for a review
 * card: "Ieri ho andato a Napoli." with `ho andato` → `sono andata` gives
 * "Ieri sono andata a Napoli.". Null when the span is not in the message
 * (then there is no sentence to practise).
 */
export function correctedSentence(learnerMessage: string, recast: TutorRecast): string | null {
  const found = findSpan(recast.learnerText, learnerMessage);
  if (found === null) return null;
  // The match leaves the message's own edge punctuation in place.
  let replacement = recast.correctedText.replace(EDGE_PUNCTUATION, '');
  if (replacement.length === 0) return null;
  if (found.index === 0 && /^\p{Lu}/u.test(learnerMessage)) {
    replacement = replacement.charAt(0).toLocaleUpperCase('it') + replacement.slice(1);
  }
  return (
    learnerMessage.slice(0, found.index) +
    replacement +
    learnerMessage.slice(found.index + found.length)
  ).trim();
}

/** The learner errors a validated turn records (provider-level view). */
export function learnerErrorsOf(output: TutorOutput): LearnerError[] {
  const { prompt, recast } = output.annotations;
  if (recast !== null) {
    return recast.errorTags.map((category) => ({
      category,
      original: recast.learnerText,
      corrected: recast.correctedText,
    }));
  }
  if (prompt !== null) {
    return prompt.errorTags.map((category) => ({
      category,
      original: prompt.learnerText,
      corrected: '',
    }));
  }
  return [];
}
