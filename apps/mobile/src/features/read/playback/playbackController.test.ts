import { createFakeTextToSpeech } from '@italia/core/testing';

import { createFakeAudioOut } from '@/speech/testing';

import {
  clampRate,
  createPlaybackController,
  type PlaybackClock,
  type PlaybackSentence,
  type PreparedSpeech,
  type SentenceSpeaker,
} from './playbackController';
import { createStorySpeaker } from './speakers';
import { estimateTimings, tokenAtChar, wordAt } from './timings';

/** A sentence with one token per space-separated word. */
function sentence(text: string): PlaybackSentence {
  const tokens: { start: number; end: number }[] = [];
  const re = /[^\s.]+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    tokens.push({ start: m.index, end: m.index + m[0].length });
  }
  return { text, tokens };
}

const SENTENCES = [sentence('Luca ha un lavoro.'), sentence('È contento.'), sentence('Va al bar.')];

/** A clock whose time and timers move only when the test says so. */
function fakeClock(): PlaybackClock & { advance(ms: number): void } {
  let now = 0;
  const timers = new Set<{ ms: number; next: number; fn: () => void }>();
  return {
    now: () => now,
    every(ms, fn) {
      const timer = { ms, next: now + ms, fn };
      timers.add(timer);
      return () => {
        timers.delete(timer);
      };
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers].filter((t) => t.next <= end).sort((a, b) => a.next - b.next)[0];
        if (!due) break;
        now = due.next;
        due.next += due.ms;
        due.fn();
      }
      now = end;
    },
  };
}

/**
 * A speaker whose sentences finish only when the test calls `finish()`; each
 * sentence lasts 100 ms per character for its estimated timings.
 */
function fakeSpeaker(options: { failPrepare?: number; boundaries?: boolean } = {}) {
  const prepared: { text: string; rate: number }[] = [];
  const playing: { text: string; finish: () => void; boundary: (c: number) => void }[] = [];
  const speaker: SentenceSpeaker = {
    prepare(s, rate) {
      prepared.push({ text: s.text, rate });
      if (options.failPrepare !== undefined && prepared.length === options.failPrepare) {
        return Promise.reject(new Error('Voice failed'));
      }
      const speech: PreparedSpeech = {
        voice: options.boundaries ? 'device' : 'neural',
        timings: estimateTimings(s.text, s.tokens, s.text.length * 100),
        timing: 'estimated',
        play(signal, onBoundary) {
          return new Promise<void>((resolve) => {
            playing.push({ text: s.text, finish: resolve, boundary: onBoundary });
            signal.addEventListener('abort', () => {
              resolve();
            });
          });
        },
      };
      return Promise.resolve(speech);
    },
  };
  return { speaker, prepared, playing };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('timings', () => {
  it('estimates token timings by character position', () => {
    const s = sentence('Luca ha un lavoro.');
    const t = estimateTimings(s.text, s.tokens, 1800);
    expect(t).toEqual([
      [0, 500],
      [500, 800],
      [800, 1100],
      [1100, 1800],
    ]);
    expect(wordAt(t, 0)).toBe(0);
    expect(wordAt(t, 850)).toBe(2);
    expect(wordAt(t, 5000)).toBe(3);
    expect(tokenAtChar(s.tokens, 8)).toBe(2);
    expect(tokenAtChar(s.tokens, 99)).toBe(3);
  });

  it('clamps speed to 0.75-1.25', () => {
    expect(clampRate(0.5)).toBe(0.75);
    expect(clampRate(1.3)).toBe(1.25);
    expect(clampRate(Number.NaN)).toBe(1);
  });
});

describe('playback controller', () => {
  it('plays the story sentence by sentence, prefetching the next, and highlights words', async () => {
    const clock = fakeClock();
    const { speaker, prepared, playing } = fakeSpeaker();
    const done: number[] = [];
    let ended = 0;
    const c = createPlaybackController({
      sentences: SENTENCES,
      speaker,
      clock,
      onSentenceDone: (i) => done.push(i),
      onEnded: () => {
        ended += 1;
      },
    });
    expect(c.getState().status).toBe('idle');
    c.toggle();
    expect(c.getState()).toMatchObject({ status: 'loading', sentenceIndex: 0 });
    await flush();
    expect(c.getState()).toMatchObject({
      status: 'playing',
      sentenceIndex: 0,
      wordIndex: 0,
      timing: 'estimated',
      voice: 'neural',
    });
    expect(prepared.map((p) => p.text)).toEqual(['Luca ha un lavoro.', 'È contento.']);

    clock.advance(850);
    expect(c.getState().wordIndex).toBe(2);

    playing[0]?.finish();
    await flush();
    expect(done).toEqual([0]);
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 1, wordIndex: 0 });
    playing[1]?.finish();
    await flush();
    playing[2]?.finish();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'ended', wordIndex: null });
    expect(done).toEqual([0, 1, 2]);
    expect(ended).toBe(1);
    // Each sentence was synthesised once.
    expect(prepared).toHaveLength(3);

    c.toggle();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 0 });
    c.dispose();
  });

  it('pauses, then resumes by replaying the current sentence', async () => {
    const { speaker, playing } = fakeSpeaker();
    const done: number[] = [];
    const c = createPlaybackController({
      sentences: SENTENCES,
      speaker,
      clock: fakeClock(),
      startAt: 1,
      onSentenceDone: (i) => done.push(i),
    });
    c.playStory();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 1 });
    c.toggle();
    expect(c.getState()).toMatchObject({ status: 'paused', sentenceIndex: 1, wordIndex: null });
    await flush();
    expect(done).toEqual([]);
    c.toggle();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 1, scope: 'story' });
    expect(playing.map((p) => p.text)).toEqual(['È contento.', 'È contento.']);
    c.dispose();
  });

  it('plays a single sentence and stops', async () => {
    const { speaker, playing } = fakeSpeaker();
    const c = createPlaybackController({ sentences: SENTENCES, speaker, clock: fakeClock() });
    c.playSentence(2);
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', scope: 'sentence', sentenceIndex: 2 });
    playing[0]?.finish();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'idle', sentenceIndex: 2 });
    expect(playing).toHaveLength(1);
    c.dispose();
  });

  it('restarts the sentence at a new speed and re-synthesises', async () => {
    const { speaker, prepared } = fakeSpeaker();
    const c = createPlaybackController({ sentences: SENTENCES, speaker, clock: fakeClock() });
    c.playStory(0);
    await flush();
    c.setRate(0.75);
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 0, rate: 0.75 });
    expect(prepared.filter((p) => p.text === 'Luca ha un lavoro.').map((p) => p.rate)).toEqual([
      1, 0.75,
    ]);
    c.setRate(2);
    expect(c.getState().rate).toBe(1.25);
    c.dispose();
  });

  it('switches to engine timing on live word events', async () => {
    const { speaker, playing } = fakeSpeaker({ boundaries: true });
    const clock = fakeClock();
    const c = createPlaybackController({ sentences: SENTENCES, speaker, clock });
    c.playStory(0);
    await flush();
    playing[0]?.boundary(11);
    expect(c.getState()).toMatchObject({ wordIndex: 3, timing: 'engine', voice: 'device' });
    // The estimate no longer moves the highlight.
    clock.advance(100);
    expect(c.getState().wordIndex).toBe(3);
    c.dispose();
  });

  it('reports a failed sentence and retries it on resume', async () => {
    const { speaker } = fakeSpeaker({ failPrepare: 1 });
    const c = createPlaybackController({ sentences: SENTENCES, speaker, clock: fakeClock() });
    c.playStory(0);
    await flush();
    expect(c.getState()).toMatchObject({ status: 'error', error: 'Voice failed' });
    c.toggle();
    await flush();
    expect(c.getState()).toMatchObject({ status: 'playing', sentenceIndex: 0, error: null });
    c.dispose();
  });
});

describe('story speaker', () => {
  const s = sentence('Luca ha un lavoro.');

  it('uses the device voice with estimated timings when the neural voice is not installed', async () => {
    const audio = createFakeAudioOut();
    const speaker = createStorySpeaker({
      tts: createFakeTextToSpeech({ availability: 'needs_download' }),
      audio,
    });
    const speech = await speaker.prepare(s, 1, new AbortController().signal);
    expect(speech).toMatchObject({ voice: 'device', timing: 'estimated' });
    await speech.play(new AbortController().signal, () => undefined);
    expect(audio.spoken.map((x) => [x.text, x.options.language])).toEqual([
      ['Luca ha un lavoro.', 'it-IT'],
    ]);
  });

  it('prefers the neural voice and uses its word timings when they line up', async () => {
    const audio = createFakeAudioOut();
    const speaker = createStorySpeaker({
      tts: createFakeTextToSpeech({ availability: 'ready' }),
      audio,
    });
    const speech = await speaker.prepare(
      { text: 'Luca ha un lavoro', tokens: s.tokens },
      1,
      new AbortController().signal,
    );
    expect(speech).toMatchObject({ voice: 'neural', timing: 'engine' });
    expect(speech.timings).toHaveLength(4);
    await speech.play(new AbortController().signal, () => undefined);
    expect(audio.played).toBe(1);
  });
});
