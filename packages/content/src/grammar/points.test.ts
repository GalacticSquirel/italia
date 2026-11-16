import { describe, expect, it } from 'vitest';

import { GRAMMAR_POINTS } from './points';

const words = (md: string) =>
  md
    .replace(/[|*#`-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w)).length;

describe('GRAMMAR_POINTS', () => {
  it('has 30 to 40 points with unique ids and slugs', () => {
    expect(GRAMMAR_POINTS.length).toBeGreaterThanOrEqual(30);
    expect(GRAMMAR_POINTS.length).toBeLessThanOrEqual(40);
    expect(new Set(GRAMMAR_POINTS.map((p) => p.id)).size).toBe(GRAMMAR_POINTS.length);
    expect(new Set(GRAMMAR_POINTS.map((p) => p.slug)).size).toBe(GRAMMAR_POINTS.length);
  });

  it('only depends on points taught earlier (so the graph is a DAG in teaching order)', () => {
    GRAMMAR_POINTS.forEach((point, index) => {
      for (const slug of point.prerequisites) {
        const at = GRAMMAR_POINTS.findIndex((p) => p.slug === slug);
        expect(at, `${point.slug} -> ${slug}`).toBeGreaterThanOrEqual(0);
        expect(at, `${point.slug} -> ${slug}`).toBeLessThan(index);
      }
    });
  });

  it('keeps CEFR bands in order', () => {
    const bands = GRAMMAR_POINTS.map((p) => p.cefr);
    expect([...bands].sort()).toEqual(bands);
  });

  it.each(GRAMMAR_POINTS.map((p) => [p.slug, p.noteMd] as const))(
    '%s: note is at most 150 words with at least two translated examples',
    (_slug, note) => {
      expect(words(note)).toBeLessThanOrEqual(150);
      const examples = note.match(/\*[^*\n]+\*\s*\([^)\n]+\)/g) ?? [];
      expect(examples.length).toBeGreaterThanOrEqual(2);
    },
  );
});
