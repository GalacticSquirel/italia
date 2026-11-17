/**
 * The grammar syllabus, A1 to C2, in acquisition order (the order from the
 * research report: noun-phrase agreement before subject-verb agreement before
 * clitics; present, then passato prossimo (avere before essere), imperfetto,
 * future, conditional, then the subjunctive and the advanced and literary
 * forms). Each level lives in `levels/`.
 *
 * Ids are fixed forever once published: add new points with new ids, never
 * renumber. `order` (the position here) may change between seed versions.
 */
import { A1_POINTS } from './levels/a1';
import { A2_POINTS } from './levels/a2';
import { B1_POINTS } from './levels/b1';
import { B2_POINTS } from './levels/b2';
import { C1_POINTS } from './levels/c1';
import { C2_POINTS } from './levels/c2';
import type { GrammarDrill, GrammarPointSource } from './types';

export {
  GRAMMAR_CEFR_LEVELS,
  type GrammarCefr,
  type GrammarDrill,
  type GrammarDrillSource,
  type GrammarPointSource,
} from './types';

/** Points in teaching order (their position is their `order`, starting at 1). */
export const GRAMMAR_POINTS: readonly GrammarPointSource[] = [
  ...A1_POINTS,
  ...A2_POINTS,
  ...B1_POINTS,
  ...B2_POINTS,
  ...C1_POINTS,
  ...C2_POINTS,
];

/** Drills per point can never exceed this (drill ids are `pointId * 100 + n`). */
export const MAX_DRILLS_PER_POINT = 99;

const GAP = /\[([^[\]]+)\]/g;

/** Split a drill sentence into the text around its single `[gap]`. */
export function parseDrillGap(it: string): { before: string; answer: string; after: string } {
  const gaps = [...it.matchAll(GAP)];
  const gap = gaps[0];
  if (gaps.length !== 1 || !gap) throw new Error(`Drill needs exactly one [gap]: ${it}`);
  const start = gap.index;
  return {
    before: it.slice(0, start),
    answer: gap[1] ?? '',
    after: it.slice(start + gap[0].length),
  };
}

/** Every drill in the syllabus, in teaching order, with stable ids. */
export const GRAMMAR_DRILLS: readonly GrammarDrill[] = GRAMMAR_POINTS.flatMap((point) =>
  point.drills.map((d, i): GrammarDrill => {
    const { before, answer, after } = parseDrillGap(d.it);
    return {
      id: point.id * 100 + i + 1,
      pointId: point.id,
      before,
      answer,
      after,
      it: before + answer + after,
      en: d.en,
      hint: d.hint,
      accepted: [answer, ...(d.also ?? [])],
    };
  }),
);
