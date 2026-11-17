import { describe, expect, it } from 'vitest';

import { GRAMMAR_DRILLS, GRAMMAR_POINTS, MAX_DRILLS_PER_POINT, parseDrillGap } from './points';
import { GRAMMAR_CEFR_LEVELS } from './types';

const words = (md: string) =>
  md
    .replace(/[|*#`-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w)).length;

/** Fewest drills a point may have, by level. */
const MIN_DRILLS = { A1: 10, A2: 10, B1: 10, B2: 10, C1: 8, C2: 8 } as const;

describe('GRAMMAR_POINTS', () => {
  it('covers A1 to C2 with unique ids and slugs', () => {
    expect(GRAMMAR_POINTS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(GRAMMAR_POINTS.map((p) => p.id)).size).toBe(GRAMMAR_POINTS.length);
    expect(new Set(GRAMMAR_POINTS.map((p) => p.slug)).size).toBe(GRAMMAR_POINTS.length);
    for (const level of GRAMMAR_CEFR_LEVELS) {
      expect(GRAMMAR_POINTS.filter((p) => p.cefr === level).length, level).toBeGreaterThan(4);
    }
  });

  it('keeps the published ids of the first 38 points', () => {
    const fixed: Record<number, string> = {
      1: 'noun-gender-number',
      13: 'irregular-present',
      20: 'piacere',
      21: 'passato-prossimo-avere',
      31: 'passato-prossimo-vs-imperfetto',
      35: 'comparatives',
      38: 'conditional',
    };
    for (const [id, slug] of Object.entries(fixed)) {
      expect(GRAMMAR_POINTS.find((p) => p.id === Number(id))?.slug).toBe(slug);
    }
    const ids = GRAMMAR_POINTS.map((p) => p.id).sort((a, b) => a - b);
    expect(ids).toEqual(ids.map((_, i) => i + 1));
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
    '%s: note has a summary, a warning and three translated examples, in at most 320 words',
    (_slug, note) => {
      expect(note).toMatch(/^\*\*In short:\*\* \S/);
      expect(note).toContain('**Watch out:**');
      expect(words(note)).toBeLessThanOrEqual(320);
      const examples = note.match(/^- \*[^*\n]+\*\s*\([^)\n]+\)/gm) ?? [];
      expect(examples.length).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(GRAMMAR_POINTS.map((p) => [p.slug, p] as const))(
    '%s: has enough well-formed drills',
    (_slug, point) => {
      expect(point.drills.length).toBeGreaterThanOrEqual(MIN_DRILLS[point.cefr]);
      expect(point.drills.length).toBeLessThanOrEqual(MAX_DRILLS_PER_POINT);
      const sentences = new Set<string>();
      for (const d of point.drills) {
        const { before, answer, after } = parseDrillGap(d.it);
        expect(answer.trim(), d.it).toBe(answer);
        expect(answer.length, d.it).toBeGreaterThan(0);
        expect(`${before}${answer}${after}`, d.it).toMatch(/[.!?…»"]$/);
        expect(d.en.trim().length, d.it).toBeGreaterThan(0);
        expect(d.hint.trim().length, d.it).toBeGreaterThan(0);
        expect(d.hint.toLowerCase(), `${d.it}: the hint gives the answer away`).not.toBe(
          answer.toLowerCase(),
        );
        for (const alt of d.also ?? []) expect(alt, d.it).not.toBe(answer);
        expect(sentences.has(d.it), `duplicate drill ${d.it}`).toBe(false);
        sentences.add(d.it);
      }
    },
  );
});

describe('GRAMMAR_DRILLS', () => {
  it('gives every drill a unique id derived from its point', () => {
    expect(new Set(GRAMMAR_DRILLS.map((d) => d.id)).size).toBe(GRAMMAR_DRILLS.length);
    for (const d of GRAMMAR_DRILLS) expect(Math.floor(d.id / 100)).toBe(d.pointId);
  });

  it('splits the gap out of the sentence', () => {
    expect(parseDrillGap('Ieri [sono andata] al mare.')).toEqual({
      before: 'Ieri ',
      answer: 'sono andata',
      after: ' al mare.',
    });
    expect(() => parseDrillGap('No gap here.')).toThrow();
    expect(() => parseDrillGap('[Two] [gaps].')).toThrow();
  });
});
