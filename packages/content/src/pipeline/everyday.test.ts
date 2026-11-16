import { describe, expect, it } from 'vitest';

import { applyRankCeilings, everydayCeilings, everydayKeys, LEVEL_CEILING } from './everyday';
import { parseMorphIt } from './lexicon';

describe('applyRankCeilings', () => {
  const letters = 'abcdefghij'.split('');

  it('keeps the order when every ceiling is met', () => {
    expect(applyRankCeilings(letters, (x) => (x === 'b' ? 5 : undefined))).toEqual(letters);
  });

  it('moves a capped item up only as far as its ceiling', () => {
    const out = applyRankCeilings(letters, (x) => (x === 'i' ? 3 : undefined));
    expect(out).toEqual(['a', 'b', 'i', 'c', 'd', 'e', 'f', 'g', 'h', 'j']);
  });

  it('meets several ceilings, earliest first and keeping frequency order', () => {
    const ceilings: Record<string, number> = { h: 2, j: 4, i: 4 };
    const out = applyRankCeilings(letters, (x) => ceilings[x]);
    expect(out).toEqual(['a', 'h', 'i', 'j', 'b', 'c', 'd', 'e', 'f', 'g']);
    for (const [x, c] of Object.entries(ceilings)) expect(out.indexOf(x) + 1).toBeLessThanOrEqual(c);
  });

  it('throws when the ceilings cannot all be met', () => {
    expect(() => applyRankCeilings(letters, (x) => (x > 'g' ? 2 : undefined))).toThrow();
  });
});

describe('everydayCeilings', () => {
  it('lists each word once with its level ceiling', () => {
    const ceilings = everydayCeilings();
    expect(ceilings.get('gennaio')).toBe(LEVEL_CEILING.A1);
    expect(ceilings.get('sei|NUM')).toBe(LEVEL_CEILING.A1);
    expect(ceilings.get('forchetta')).toBe(LEVEL_CEILING.A2);
    expect(ceilings.get('nuora')).toBe(LEVEL_CEILING.B1);
    expect(ceilings.get('vendemmia')).toBe(LEVEL_CEILING.B2);
    expect(ceilings.size).toBeGreaterThan(400);
  });
});

describe('everydayKeys', () => {
  it('resolves bare lemmas to their most frequent content-word key', () => {
    const lexicon = parseMorphIt(
      [
        'nuora\tnuora\tNOUN-F:s',
        'sei\tessere\tAUX:ind+pres+2+s',
        'sei\tsei\tDET-NUM-CARD',
        'rosa\trosa\tNOUN-F:s',
        'rosa\trosa\tADJ:pos+f+s',
      ].join('\n'),
    );
    const counts = new Map([
      ['rosa|NOUN', 5],
      ['rosa|ADJ', 9],
    ]);
    const ceilings = new Map([
      ['nuora', 3000],
      ['sei|NUM', 500],
      ['rosa', 500],
    ]);
    expect(everydayKeys(ceilings, counts, lexicon)).toEqual(
      new Map([
        ['nuora|NOUN', 3000],
        ['sei|NUM', 500],
        ['rosa|ADJ', 500],
      ]),
    );
    expect(() => everydayKeys(new Map([['zzz', 500]]), counts, lexicon)).toThrow(/zzz/);
  });
});
