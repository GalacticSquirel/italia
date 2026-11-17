/**
 * Turns recognised phones into the app's pronunciation result: G2P of the
 * expected text, alignment and GOP scores, the targeted checks of
 * `@italia/speech`, and a few prioritised issues phrased for the learner.
 * Pure: the phones come from the recognizer (see `scorer.ts`).
 */
import type { PronunciationScore as AppScore, PronunciationIssue } from '@italia/core';
import {
  checkGeminates,
  checkSegmentals,
  checkStress,
  g2p,
  scorePronunciation,
  syllableProsodyFromScore,
  type Feedback,
  type G2PResult,
  type PronunciationScore,
  type RecognizedPhone,
} from '@italia/speech';

import { rms } from '../pcm';
import { feedbackText, isActionable, issueKind } from './feedbackText';

/** Most issues shown per answer: correct one or two salient errors, not everything. */
export const MAX_ISSUES = 2;

/** Order in which issue kinds are worth fixing (intelligibility first). */
const PRIORITY: Readonly<Record<PronunciationIssue['kind'], number>> = {
  double_consonant: 0,
  stress: 1,
  vowel_quality: 2,
  other: 3,
};

/** Feedback attached to a word. */
export interface WordFeedback {
  wordIndex: number;
  feedback: Feedback;
}

/** Everything the scorer worked out. */
export interface PronunciationAnalysis {
  g2p: G2PResult;
  detail: PronunciationScore;
  /** Every check's feedback, including confirmations. */
  feedback: WordFeedback[];
  /** The result in `@italia/core`'s provider shape (scores 0 to 1). */
  score: AppScore;
}

/** Audio used for energy cues in the stress check. */
export interface AnalysisAudio {
  samples: Float32Array;
  sampleRateHz: number;
}

function energyBetween(audio: AnalysisAudio, startMs: number, endMs: number): number {
  const from = Math.floor((startMs / 1000) * audio.sampleRateHz);
  const to = Math.ceil((endMs / 1000) * audio.sampleRateHz);
  return rms(audio.samples.subarray(Math.max(0, from), Math.max(from, to)));
}

/** Score `phones` against `expectedText`. */
export function analysePronunciation(
  expectedText: string,
  phones: readonly RecognizedPhone[],
  audio?: AnalysisAudio,
): PronunciationAnalysis {
  const result = g2p(expectedText);
  const detail = scorePronunciation(result, phones);
  const feedback: WordFeedback[] = [];

  for (const check of checkGeminates(result, detail)) {
    feedback.push({ wordIndex: check.wordIndex, feedback: check.feedback });
  }
  result.words.forEach((word, wordIndex) => {
    if (word.syllables.length < 2 || word.stressedSyllable === null) return;
    const prosody = syllableProsodyFromScore(result, detail, wordIndex);
    if (prosody.some((p) => p.durationMs <= 0)) return; // a nucleus was not heard
    const withEnergy = audio
      ? prosody.map((p, s) => {
          const syllable = word.syllables[s];
          const nucleus = syllable?.phonemes.find((i) => word.phonemes[i]?.role === 'nucleus');
          const phone = detail.phones.find(
            (ph) => ph.wordIndex === wordIndex && ph.phoneIndex === nucleus,
          );
          const seg = phone?.segment == null ? undefined : detail.segments[phone.segment];
          return seg ? { ...p, energy: energyBetween(audio, seg.startMs, seg.endMs) } : p;
        })
      : prosody;
    const energyKnown = withEnergy.every((p) => 'energy' in p);
    const check = checkStress(word, energyKnown ? withEnergy : prosody);
    feedback.push({ wordIndex, feedback: check.feedback });
  });
  for (const issue of checkSegmentals(result, detail)) {
    feedback.push({ wordIndex: issue.wordIndex, feedback: issue.feedback });
  }

  const issues: PronunciationIssue[] = [];
  if (detail.segments.length === 0) {
    issues.push({
      kind: 'other',
      wordIndex: 0,
      message: 'We could not hear you. Try again a little closer to the microphone.',
    });
  } else {
    const seen = new Set<number>();
    const ranked = feedback
      .filter((f) => isActionable(f.feedback.key))
      .map((f) => ({ ...f, kind: issueKind(f.feedback.key) }))
      .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.wordIndex - b.wordIndex);
    for (const f of ranked) {
      if (issues.length >= MAX_ISSUES) break;
      if (seen.has(f.wordIndex)) continue; // one tip per word
      seen.add(f.wordIndex);
      issues.push({ kind: f.kind, wordIndex: f.wordIndex, message: feedbackText(f.feedback) });
    }
  }

  const score: AppScore = {
    overall: detail.score / 100,
    words: result.words.map((word, wordIndex) => {
      const ws = detail.words.find((w) => w.wordIndex === wordIndex);
      return {
        word: word.text,
        score: (ws?.score ?? 0) / 100,
        phonemes: detail.phones
          .filter((p) => p.wordIndex === wordIndex)
          .map((p) => {
            const seg = p.segment === null ? undefined : detail.segments[p.segment];
            return {
              phoneme: p.phoneme,
              score: p.score / 100,
              startMs: seg?.startMs ?? 0,
              endMs: seg?.endMs ?? 0,
            };
          }),
      };
    }),
    issues,
  };
  return { g2p: result, detail, feedback, score };
}
