import { GRAMMAR_POINTS, type GrammarCefr, type GrammarDrill } from '@italia/content';

import type { CardRow, GrammarPointRow } from '@/data';
import type { ContentIndex } from '@/features/study/content';
import { GRAMMAR_WORD_GATE, unlockedGrammar } from '@/features/study/curriculum';

/** Where a grammar point stands for the learner. */
export type GrammarStatus = 'learnt' | 'next' | 'locked';

/** One grammar point in the guide. */
export interface GuidePoint {
  point: GrammarPointRow;
  cefr: GrammarCefr | null;
  status: GrammarStatus;
  /** Drills answered at least once. */
  drillsDone: number;
  drillsTotal: number;
}

/** A CEFR level's points in the guide. */
export interface GuideLevel {
  cefr: GrammarCefr | null;
  /** Words to meet before this level's grammar opens. */
  wordsNeeded: number;
  points: GuidePoint[];
}

const cefrById = new Map(GRAMMAR_POINTS.map((p) => [p.id, p.cefr]));

/** The CEFR level of a grammar point, or null for a point outside the syllabus. */
export const grammarCefr = (pointId: number): GrammarCefr | null => cefrById.get(pointId) ?? null;

/**
 * The grammar guide: every point in teaching order, grouped by level, with
 * whether it is learnt, the next one to learn, or still locked.
 */
export function buildGrammarGuide(content: ContentIndex, cards: readonly CardRow[]): GuideLevel[] {
  const unlocked = unlockedGrammar(cards, content);
  const done = new Set(
    cards.filter((c) => c.kind === 'grammar_drill' && c.state !== 'new').map((c) => c.targetId),
  );
  const firstLocked = content.grammar.find((g) => !unlocked.has(g.id));
  const levels: GuideLevel[] = [];
  for (const point of content.grammar) {
    const cefr = grammarCefr(point.id);
    let level = levels.at(-1);
    if (level?.cefr !== cefr) {
      level = { cefr, wordsNeeded: cefr ? GRAMMAR_WORD_GATE[cefr] : 0, points: [] };
      levels.push(level);
    }
    const drills: readonly GrammarDrill[] = content.drillsByPoint.get(point.id) ?? [];
    level.points.push({
      point,
      cefr,
      status: unlocked.has(point.id) ? 'learnt' : point === firstLocked ? 'next' : 'locked',
      drillsDone: drills.filter((d) => done.has(d.id)).length,
      drillsTotal: drills.length,
    });
  }
  return levels;
}

/** Status shown next to a point. */
export const STATUS_TEXT: Record<GrammarStatus, string> = {
  learnt: 'Learnt',
  next: 'Up next',
  locked: 'Not yet',
};
