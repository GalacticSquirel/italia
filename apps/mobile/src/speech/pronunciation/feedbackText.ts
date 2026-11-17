/**
 * Friendly English for `@italia/speech` feedback keys. The checks return
 * keys with parameters (never prose); this is the one place they are phrased.
 */
import type { PronunciationIssue } from '@italia/core';
import type { Feedback, FeedbackKey } from '@italia/speech';

type Params = Feedback['params'];

const str = (params: Params, key: string, fallback = ''): string => {
  const value = params[key];
  return value === undefined ? fallback : String(value);
};

const word = (p: Params) => `“${str(p, 'word')}”`;
const letters = (p: Params) => `“${str(p, 'letters', str(p, 'phoneme'))}”`;

const TEXT: Readonly<Record<FeedbackKey, (p: Params) => string>> = {
  'speech.geminate.ok': (p) => `Nice double ${letters(p)} in ${word(p)}.`,
  'speech.geminate.soundedSingle': (p) =>
    `Hold the double ${letters(p)} in ${word(p)} longer: pause on it briefly, as in “fatto”, not “fato”.`,
  'speech.geminate.borderline': (p) =>
    `The double ${letters(p)} in ${word(p)} was nearly long enough. Hold it a little longer.`,
  'speech.geminate.soundedDouble': (p) =>
    `The ${letters(p)} in ${word(p)} is single. Keep it short.`,
  'speech.geminate.missing': (p) => `We did not hear the ${letters(p)} in ${word(p)}.`,
  'speech.geminate.insufficientData': (p) =>
    `We could not measure the consonant length in ${word(p)}. Try speaking a little louder.`,
  'speech.stress.ok': (p) => `Stress in the right place in ${word(p)}.`,
  'speech.stress.wrongSyllable': (p) =>
    `In ${word(p)}, stress “${str(p, 'expected')}”, not “${str(p, 'heard')}”.`,
  'speech.stress.unclear': (p) =>
    `Make the stressed syllable “${str(p, 'expected')}” of ${word(p)} stand out more.`,
  'speech.stress.notApplicable': (p) => `${word(p)} has no stress to check.`,
  'speech.vowel.finalReduced': (p) =>
    `Say the final ${letters(p)} of ${word(p)} as a clear, full vowel. Italian never swallows it.`,
  'speech.vowel.finalDropped': (p) => `Do not drop the final vowel of ${word(p)}.`,
  'speech.vowel.reduced': (p) =>
    `Keep the ${letters(p)} in ${word(p)} a clear vowel, even when it is not stressed.`,
  'speech.vowel.diphthongised': (p) =>
    `Keep the ${letters(p)} in ${word(p)} pure and steady, without gliding into another vowel.`,
  'speech.consonant.aspirated': (p) => `Say the ${letters(p)} in ${word(p)} without a puff of air.`,
};

/** The English sentence for a feedback key and its parameters. */
export function feedbackText(feedback: Feedback): string {
  return TEXT[feedback.key](feedback.params);
}

/** Keys that tell the learner to change something (the rest confirm or say nothing). */
const ACTIONABLE = new Set<FeedbackKey>([
  'speech.geminate.soundedSingle',
  'speech.geminate.borderline',
  'speech.geminate.soundedDouble',
  'speech.geminate.missing',
  'speech.stress.wrongSyllable',
  'speech.stress.unclear',
  'speech.vowel.finalReduced',
  'speech.vowel.finalDropped',
  'speech.vowel.reduced',
  'speech.vowel.diphthongised',
  'speech.consonant.aspirated',
]);

/** Whether a key asks the learner to change something. */
export function isActionable(key: FeedbackKey): boolean {
  return ACTIONABLE.has(key);
}

/** The issue kind of `@italia/core` for a feedback key. */
export function issueKind(key: FeedbackKey): PronunciationIssue['kind'] {
  if (key.startsWith('speech.geminate.')) return 'double_consonant';
  if (key.startsWith('speech.stress.')) return 'stress';
  if (key.startsWith('speech.vowel.')) return 'vowel_quality';
  return 'other';
}
