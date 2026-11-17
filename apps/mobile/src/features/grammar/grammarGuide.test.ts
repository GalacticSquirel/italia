import { createScheduler } from '@italia/core';

import { cardIdFor, type CardRow, type GrammarPointRow } from '@/data';
import { buildContentIndex } from '@/features/study/content';

import { buildGrammarGuide, grammarCefr } from './grammarGuide';

const point = (id: number, title: string, order: number): GrammarPointRow => ({
  id,
  title,
  order,
  prerequisiteIds: [],
  noteMd: '**In short:** x',
});

const answered = (kind: CardRow['kind'], targetId: number): CardRow => ({
  ...createScheduler().newCard(new Date(0)),
  id: cardIdFor(kind, targetId, 'typed'),
  kind,
  targetId,
  promptMode: 'typed',
  state: 'review',
  reps: 1,
  suspended: false,
  createdAt: new Date(0),
  flagUpdatedAt: null,
  flagDeviceId: null,
  flagSyncedAt: null,
});

describe('grammar guide', () => {
  it('groups points by level with their status and drill progress', () => {
    // Syllabus ids 1 (A1), 21 (A2) and 38 (B1), with their real drills.
    const content = buildContentIndex(
      [],
      [],
      [
        point(1, 'Nouns: gender and number', 1),
        point(21, 'Passato prossimo with avere', 2),
        point(38, 'The conditional: vorrei, potrei', 3),
      ],
    );
    expect(grammarCefr(38)).toBe('B1');
    const first = content.drillsByPoint.get(1)?.[0];
    if (!first) throw new Error('no drills for point 1');
    const levels = buildGrammarGuide(content, [answered('grammar_drill', first.id)]);
    expect(levels.map((l) => [l.cefr, l.wordsNeeded])).toEqual([
      ['A1', 0],
      ['A2', 150],
      ['B1', 500],
    ]);
    const [a1, a2, b1] = levels.map((l) => l.points[0]);
    expect(a1?.status).toBe('learnt');
    expect(a1?.drillsDone).toBe(1);
    expect(a1?.drillsTotal).toBeGreaterThanOrEqual(10);
    expect(a2?.status).toBe('next');
    expect(b1?.status).toBe('locked');
  });
});
