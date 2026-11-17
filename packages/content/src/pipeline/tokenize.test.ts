import { describe, expect, it } from 'vitest';

import { tokenize } from './tokenize';

describe('tokenize', () => {
  it('splits elisions after the apostrophe and drops punctuation', () => {
    expect(tokenize("L'acqua c'è, vero?").map((t) => t.text)).toEqual([
      "L'",
      'acqua',
      "c'",
      'è',
      'vero',
    ]);
  });

  it("keeps a trailing apostrophe (po') and normalises typographic apostrophes", () => {
    expect(tokenize('Un po’ di pane.').map((t) => t.lower)).toEqual(['un', "po'", 'di', 'pane']);
  });

  it('records offsets into the original text and flags digits', () => {
    const text = 'Ho 3 gatti.';
    const tokens = tokenize(text);
    expect(tokens.map((t) => text.slice(t.start, t.end))).toEqual(['Ho', '3', 'gatti']);
    expect(tokens.map((t) => t.numeric)).toEqual([false, true, false]);
  });
});
