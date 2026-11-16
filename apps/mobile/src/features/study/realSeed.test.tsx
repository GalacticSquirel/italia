/**
 * The curriculum, prompts and grammar notes against the real content seed
 * (not the small fixture): what a learner meets on a fresh install.
 */
import { render, screen } from '@testing-library/react-native';

import { GRAMMAR_POINTS } from '@italia/content';

import { cardIdFor, createRepositories, type CardRow } from '@/data';
import type { TestDatabase } from '@/db/testing/createTestDatabase';
import { GrammarIntroCard } from '@/features/session/components/GrammarIntroCard';
import { createRealSeedDatabase } from '@/testing/realSeed';
import { parseInline, parseMarkdown, ThemeProvider } from '@/ui';

import { getContentIndex, type ContentIndex } from './content';
import { buildCurriculum } from './curriculum';
import { resolvePrompt } from './prompts';

jest.setTimeout(30_000);

let t: TestDatabase;
let content: ContentIndex;

beforeAll(async () => {
  t = await createRealSeedDatabase();
  content = getContentIndex(createRepositories(t.db));
});

afterAll(() => {
  t.close();
});

const answered = (kind: CardRow['kind'], targetId: number): CardRow => ({
  id: cardIdFor(kind, targetId, 'typed'),
  kind,
  targetId,
  promptMode: 'typed',
  due: new Date(0),
  stability: 1,
  difficulty: 5,
  scheduledDays: 1,
  learningSteps: 0,
  reps: 1,
  lapses: 0,
  state: 'review',
  lastReview: new Date(0),
  suspended: false,
  createdAt: new Date(0),
  flagUpdatedAt: null,
  flagDeviceId: null,
  flagSyncedAt: null,
});

describe('real seed: first items on a fresh install', () => {
  it('introduces the most frequent words first, each with a usable sentence', () => {
    const { candidates, wordsAvailable, frontierGrammarId } = buildCurriculum(content, [], {
      words: 10,
      practice: 0,
    });
    expect(wordsAvailable).toBeGreaterThan(2900);
    const first20 = candidates.slice(0, 20);
    expect(first20).toHaveLength(20);

    // Recognition cards come in frequency order, and only high-frequency words appear.
    const ranks = first20
      .filter((c) => c.kind === 'recognition')
      .map((c) => content.lemmaById.get(c.targetId)?.freqRank ?? Infinity);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const c of first20) {
      expect(['recognition', 'cloze_production']).toContain(c.kind);
      expect(content.lemmaById.get(c.targetId)?.freqRank).toBeLessThanOrEqual(20);
    }

    for (const c of first20) {
      const prompt = resolvePrompt({ ...c, reps: 0 }, content);
      if (prompt?.kind === 'recognition') {
        expect(prompt.example?.lemmaIds).toContain(c.targetId);
      } else if (prompt?.kind === 'cloze_production') {
        const { before, answer, after } = prompt.blank;
        expect(answer.trim()).not.toBe('');
        expect(before + answer + after).toBe(prompt.sentence.it);
        expect(prompt.sentence.lemmaIds).toContain(c.targetId);
        expect(prompt.accepted).toEqual([answer]);
      } else {
        throw new Error(`no prompt for ${c.id}`);
      }
    }

    // Hand-written drills need no known words, so the first grammar point is up next.
    expect(frontierGrammarId).toBe(content.grammar[0]?.id);
  });

  it('every grammar point is gated by earlier points', () => {
    const order = new Map(content.grammar.map((g) => [g.id, g.order]));
    for (const g of content.grammar) {
      for (const p of g.prerequisiteIds) expect(order.get(p)).toBeLessThan(g.order);
    }
  });

  it('has drills for every grammar point', () => {
    const short = content.grammar.filter((g) => (content.drillsByPoint.get(g.id)?.length ?? 0) < 8);
    expect(short.map((g) => g.title)).toEqual([]);
  });

  it('unlocks grammar step by step with drills, up to the vocabulary gate', () => {
    const cards = content.lemmas.slice(0, 300).map((l) => answered('recognition', l.id));
    const unlockedInOrder: number[] = [];
    for (;;) {
      const curriculum = buildCurriculum(content, cards, { words: 0, practice: 5 });
      const frontier = curriculum.frontierGrammarId;
      if (frontier === null) break;
      expect(curriculum.unlockedGrammarIds.has(frontier)).toBe(false);
      const item = curriculum.candidates.find((c) => c.kind === 'grammar_drill');
      if (!item) throw new Error(`no drill for point ${String(frontier)}`);
      expect(item.grammarIds).toEqual([frontier]);
      const prompt = resolvePrompt({ ...item, reps: 0 }, content);
      if (prompt?.kind !== 'grammar_drill') throw new Error('not a grammar drill');
      expect(prompt.drill.pointId).toBe(frontier);
      expect(prompt.grammarPoint?.id).toBe(frontier);
      expect(prompt.accepted[0]).toBe(prompt.blank.answer);
      for (const c of curriculum.candidates) {
        expect(resolvePrompt({ ...c, reps: 0 }, content)).not.toBeNull();
      }
      cards.push(answered('grammar_drill', item.targetId));
      unlockedInOrder.push(frontier);
    }
    // Points unlock in acquisition order, and with 300 words met only A1 and
    // A2 are open: the B1 gate needs more vocabulary.
    const order = unlockedInOrder.map((id) => content.grammarById.get(id)?.order ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const levels = new Set(
      unlockedInOrder.map((id) => GRAMMAR_POINTS.find((p) => p.id === id)?.cefr),
    );
    expect([...levels]).toEqual(['A1', 'A2']);
    expect(unlockedInOrder.length).toBe(
      GRAMMAR_POINTS.filter((p) => p.cefr === 'A1' || p.cefr === 'A2').length,
    );
    // With grammar unlocked, its remaining drills and other sentence practice follow.
    const later = buildCurriculum(content, cards, { words: 0, practice: 10 });
    expect(later.candidates.some((c) => c.kind === 'grammar_drill')).toBe(true);
    expect(later.candidates.some((c) => c.kind !== 'grammar_drill')).toBe(true);
  });
});

describe('real seed: grammar intro notes', () => {
  it('use only the Markdown the app renders', () => {
    for (const g of content.grammar) {
      for (const block of parseMarkdown(g.noteMd)) {
        const texts = block.type === 'table' ? block.rows.flat() : [block.text];
        for (const span of texts.flatMap(parseInline)) {
          expect(span.text).not.toMatch(/\*|`|^#|\|/);
        }
      }
    }
  });

  it('render as intro cards', async () => {
    const point = content.grammar[0];
    if (!point) throw new Error('no grammar');
    await render(
      <ThemeProvider scheme="light">
        <GrammarIntroCard point={point} onContinue={() => undefined} />
      </ThemeProvider>,
    );
    expect(screen.getByText(point.title)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start practising' })).toBeOnTheScreen();
  });
});
