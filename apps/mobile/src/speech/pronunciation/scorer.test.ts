import { createTestAbortController } from '@italia/core/testing';

import { createPronunciationScorer, type ScorerDeps } from './scorer';

function deps(overrides: Partial<ScorerDeps> = {}): ScorerDeps {
  let t = 0;
  const seg = (phone: string, ms: number) => {
    const p = { phone, startMs: t, endMs: t + ms, prob: 0.9 };
    t += ms;
    return p;
  };
  return {
    availability: () => 'ready',
    phonemizer: () =>
      Promise.resolve({
        recognize: (samples: Float32Array) => {
          t = 0;
          return Promise.resolve(
            samples.length === 0 ? [] : [seg('tʃ', 80), seg('a', 120), seg('o', 100)],
          );
        },
        release: () => Promise.resolve(),
      }),
    decodeFile: () => Promise.resolve(new Float32Array(16_000)),
    ...overrides,
  };
}

describe('createPronunciationScorer', () => {
  it('scores recorded PCM against the expected text', async () => {
    const scorer = createPronunciationScorer(deps());
    expect(await scorer.availability()).toBe('ready');
    const score = await scorer.score({
      audio: { kind: 'pcm', samples: new Float32Array(48_000), sampleRateHz: 48_000 },
      expectedText: 'Ciao!',
    });
    expect(score.overall).toBeGreaterThan(0.8);
    expect(score.words.map((w) => w.word)).toEqual(['Ciao']);
  });

  it('decodes files and exposes the full analysis', async () => {
    const decodeFile = jest.fn(() => Promise.resolve(new Float32Array(8000)));
    const scorer = createPronunciationScorer(deps({ decodeFile }));
    const analysis = await scorer.analyse({
      audio: { kind: 'file', uri: 'file:///a.wav' },
      expectedText: 'ciao',
    });
    expect(decodeFile).toHaveBeenCalledWith('file:///a.wav');
    expect(analysis.g2p.words).toHaveLength(1);
  });

  it('stops when aborted', async () => {
    const controller = createTestAbortController();
    controller.abort();
    await expect(
      createPronunciationScorer(deps()).score(
        { audio: { kind: 'file', uri: 'x' }, expectedText: 'ciao' },
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});
