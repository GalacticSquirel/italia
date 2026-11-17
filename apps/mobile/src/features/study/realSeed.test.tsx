/**
 * The curriculum, prompts and grammar notes against the real content seed
 * (not the small fixture): what a learner meets on a fresh install.
 */
import { render, screen } from '@testing-library/react-native';

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

    // No sentence is made only of known words yet, so no grammar point is up next.
    expect(frontierGrammarId).toBeNull();
  });

  it('every grammar point is gated by earlier points', () => {
    const order = new Map(content.grammar.map((g) => [g.id, g.order]));
    for (const g of content.grammar) {
      for (const p of g.prerequisiteIds) expect(order.get(p)).toBeLessThan(g.order);
    }
  });

  it('unlocks grammar step by step once the first 300 words are known', () => {
    const cards = content.lemmas.slice(0, 300).map((l) => answered('recognition', l.id));
    const unlockedInOrder: number[] = [];
    for (let step = 0; step < 6; step++) {
      const curriculum = buildCurriculum(content, cards, { words: 0, practice: 5 });
      const frontier = curriculum.frontierGrammarId;
      if (frontier === null) throw new Error(`no frontier at step ${String(step)}`);
      expect(curriculum.unlockedGrammarIds.has(frontier)).toBe(false);
      const item = curriculum.candidates.find((c) => c.kind === 'grammar_cloze');
      if (!item) throw new Error(`no grammar cloze for point ${String(frontier)}`);
      expect(item.grammarIds).toEqual([frontier]);
      const prompt = resolvePrompt({ ...item, reps: 0 }, content);
      if (prompt?.kind !== 'grammar_cloze') throw new Error('not a grammar cloze');
      expect(prompt.blank.before + prompt.blank.answer + prompt.blank.after).toBe(
        prompt.sentence.it,
      );
      expect(prompt.grammarPoint?.id).toBe(frontier);
      for (const c of curriculum.candidates) {
        expect(resolvePrompt({ ...c, reps: 0 }, content)).not.toBeNull();
      }
      cards.push(answered('grammar_cloze', item.targetId));
      unlockedInOrder.push(frontier);
    }
    // Points unlock in acquisition order.
    const order = unlockedInOrder.map((id) => content.grammarById.get(id)?.order ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // With grammar unlocked, other sentence practice follows.
    const later = buildCurriculum(content, cards, { words: 0, practice: 10 });
    expect(later.candidates.some((c) => c.kind !== 'grammar_cloze')).toBe(true);
  });
});

describe('real seed: grammar intro notes', () => {
  it('use only the Markdown the app renders', () => {
    for (const g of content.grammar) {
      for (const block of parseMarkdown(g.noteMd)) {
        for (const span of parseInline(block.text)) {
          expect(span.text).not.toMatch(/\*|`|^#/);
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
