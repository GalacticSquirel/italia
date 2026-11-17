import type { PronunciationScore } from '@italia/core';

import {
  createDrill,
  currentItem,
  currentOutcome,
  drillReducer,
  type DrillEvent,
  type DrillItem,
  type DrillState,
} from './drillMachine';
import { createSilenceDetector } from './silence';

const items: DrillItem[] = [
  { cardId: 'a', cue: 'Good evening', answer: 'Buona sera', accepted: ['Buona sera'] },
  { cardId: 'b', cue: 'Thank you', answer: 'Grazie', accepted: ['Grazie'] },
];

const run = (state: DrillState, ...events: DrillEvent[]) => events.reduce(drillReducer, state);
const said = (transcript: string, latencyMs = 8000): DrillEvent => ({
  type: 'transcribed',
  transcript,
  latencyMs,
});

describe('drillReducer', () => {
  it('runs cue, listening, transcription, answer and feedback for each item', () => {
    let s = createDrill(items);
    expect(s.phase).toBe('ready');
    s = run(s, { type: 'start' });
    expect(s.phase).toBe('cue');
    expect(currentItem(s)?.cue).toBe('Good evening');
    s = run(s, { type: 'cueDone' }, { type: 'recorded' });
    expect(s.phase).toBe('transcribing');
    s = run(s, said('buona sera'));
    expect(s.phase).toBe('answer');
    expect(currentOutcome(s)).toMatchObject({ cardId: 'a', rating: 'good', correctInTheEnd: true });
    s = run(s, { type: 'answerDone' });
    expect(s.phase).toBe('feedback');
    s = run(s, { type: 'next' });
    expect(s).toMatchObject({ phase: 'cue', index: 1, attempt: 1, first: null });
    s = run(s, { type: 'cueDone' }, { type: 'recorded' }, said('grazie', 500));
    expect(s.outcomes.at(-1)?.rating).toBe('easy');
    s = run(s, { type: 'answerDone' }, { type: 'next' });
    expect(s.phase).toBe('done');
    expect(currentItem(s)).toBeNull();
  });

  it('prompts once after a miss and keeps the first rating', () => {
    let s = run(createDrill(items), { type: 'start' }, { type: 'cueDone' }, { type: 'recorded' });
    s = run(s, said('buono serra mio'));
    expect(s.phase).toBe('retry');
    expect(s.attempt).toBe(2);
    expect(s.outcomes).toHaveLength(0);
    s = run(s, { type: 'retryDone' }, { type: 'recorded' }, said('buona sera'));
    expect(s.phase).toBe('answer');
    expect(s.outcomes[0]).toMatchObject({
      rating: 'again',
      transcript: 'buono serra mio',
      correctInTheEnd: true,
    });
  });

  it('goes straight to the answer after a miss when retries are off', () => {
    const s = run(
      createDrill(items, { allowRetry: false }),
      { type: 'start' },
      { type: 'cueDone' },
      { type: 'recorded' },
      said('niente'),
    );
    expect(s.phase).toBe('answer');
    expect(s.outcomes[0]?.rating).toBe('again');
  });

  it('listens again after a recognition error', () => {
    const s = run(
      createDrill(items),
      { type: 'start' },
      { type: 'cueDone' },
      { type: 'recorded' },
      { type: 'failed', message: 'No speech' },
    );
    expect(s).toMatchObject({ phase: 'listening', error: 'No speech' });
    expect(run(s, { type: 'recorded' }).error).toBeNull();
  });

  it('keeps the pronunciation score of the current attempt only', () => {
    const score: PronunciationScore = { overall: 0.7, words: [], issues: [] };
    let s = run(createDrill(items), { type: 'start' }, { type: 'cueDone' });
    s = run(s, { type: 'scored', score, attempt: 1, index: 1 });
    expect(s.pronunciation).toBeNull();
    s = run(s, { type: 'scored', score, attempt: 1, index: 0 });
    expect(s.pronunciation?.overall).toBe(0.7);
  });

  it('skips an item without rating it and ignores events out of phase', () => {
    let s = run(createDrill(items), { type: 'start' });
    s = run(s, { type: 'answerDone' }, { type: 'next' }, { type: 'recorded' });
    expect(s.phase).toBe('cue');
    s = run(s, { type: 'skip' });
    expect(s).toMatchObject({ index: 1, skipped: 1, outcomes: [] });
    expect(createDrill([]).phase).toBe('done');
  });
});

describe('createSilenceDetector', () => {
  it('stops after speech followed by silence', () => {
    const d = createSilenceDetector({ silenceMs: 600, minSpeechMs: 200 });
    expect(d.push(0.01, 100)).toBeNull();
    expect(d.push(0.3, 200)).toBeNull();
    expect(d.push(0.3, 500)).toBeNull();
    expect(d.heardSpeech).toBe(true);
    expect(d.push(0.01, 600)).toBeNull();
    expect(d.push(0.06, 900)).toBeNull(); // between thresholds: not speech, not silence
    expect(d.push(0.01, 1300)).toBe('endOfSpeech');
  });

  it('gives up without speech and caps the answer length', () => {
    expect(createSilenceDetector({ noSpeechMs: 1000 }).push(0.01, 1000)).toBe('noSpeech');
    const d = createSilenceDetector({ maxMs: 2000 });
    d.push(0.5, 100);
    expect(d.push(0.5, 2000)).toBe('maxDuration');
  });
});
