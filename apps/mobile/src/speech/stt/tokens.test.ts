import { wordsFromTokens } from './tokens';

describe('wordsFromTokens', () => {
  it('joins subword tokens into timed words', () => {
    expect(
      wordsFromTokens(['▁Cia', 'o', ',', '▁come', '▁stai', '?'], [0, 0.2, 0.32, 0.6, 1.0, 1.3]),
    ).toEqual([
      { text: 'Ciao,', startMs: 0, endMs: 600 },
      { text: 'come', startMs: 600, endMs: 1000 },
      { text: 'stai?', startMs: 1000, endMs: 1500 },
    ]);
  });

  it('uses token durations when the model gives them', () => {
    expect(wordsFromTokens(['▁sì'], [0.5], [0.24])).toEqual([
      { text: 'sì', startMs: 500, endMs: 740 },
    ]);
  });

  it('handles a first token without a marker and empty input', () => {
    expect(wordsFromTokens(['ciao'], [0])).toEqual([{ text: 'ciao', startMs: 0, endMs: 200 }]);
    expect(wordsFromTokens([], [])).toEqual([]);
  });
});
