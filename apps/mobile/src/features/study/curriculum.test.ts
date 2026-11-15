import { createScheduler } from '@italia/core';

import { cardIdFor, createRepositories, importSeedContent, type CardRow } from '@/data';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';

import { getContentIndex } from './content';
import { buildCurriculum, frontierGrammar } from './curriculum';
import { resolvePrompt } from './prompts';

let t: TestDatabase;

beforeEach(async () => {
  t = createTestDatabase();
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
});

afterEach(() => {
  t.close();
});

const introduced = (kind: CardRow['kind'], targetId: number): CardRow => ({
  ...createScheduler().newCard(new Date(0)),
  id: cardIdFor(kind, targetId, 'typed'),
  kind,
  targetId,
  promptMode: 'typed',
  state: 'review',
  reps: 1,
  suspended: false,
  createdAt: new Date(0),
});

describe('curriculum', () => {
  it('orders new words by frequency, each exposure before its delayed cloze', () => {
    const content = getContentIndex(createRepositories(t.db));
    const { candidates, wordsAvailable } = buildCurriculum(content, [], { words: 3, practice: 2 });
    expect(wordsAvailable).toBe(33);
    expect(candidates.map((c) => c.id)).toEqual([
      'recognition:1:typed',
      'recognition:2:typed',
      'cloze_production:1:typed',
      'recognition:3:typed',
      'cloze_production:2:typed',
      'cloze_production:3:typed',
    ]);
  });

  it('unlocks grammar in order and adds sentence practice for introduced words', () => {
    const content = getContentIndex(createRepositories(t.db));
    const cards = content.lemmas.map((l) => introduced('recognition', l.id));
    const first = buildCurriculum(content, cards, { words: 0, practice: 10 });
    expect(first.frontierGrammarId).toBe(1);
    // Only items for the frontier point until it is unlocked.
    expect(first.candidates.every((c) => c.kind === 'grammar_cloze')).toBe(true);
    expect(first.candidates.length).toBeGreaterThan(0);
    expect(first.candidates.every((c) => c.grammarIds[0] === 1)).toBe(true);

    const unlockedCard = introduced('grammar_cloze', first.candidates[0]?.targetId ?? 0);
    const second = buildCurriculum(content, [...cards, unlockedCard], { words: 0, practice: 10 });
    expect([...second.unlockedGrammarIds]).toEqual([1]);
    expect(second.frontierGrammarId).toBe(2);
    const kinds = new Set(second.candidates.map((c) => c.kind));
    expect(kinds.has('grammar_cloze')).toBe(true);
    expect([...kinds].some((k) => k === 'sentence_production' || k === 'dictation')).toBe(true);
    for (const c of second.candidates)
      expect(resolvePrompt({ ...c, reps: 0 }, content)).not.toBeNull();
  });

  it('puts frontier grammar first even when shorter practice sentences fill the limit', () => {
    const content = getContentIndex(createRepositories(t.db));
    const cards = content.lemmas.map((l) => introduced('recognition', l.id));
    const first = buildCurriculum(content, cards, { words: 0, practice: 10 });
    const unlock = introduced('grammar_cloze', first.candidates[0]?.targetId ?? 0);
    const { candidates, frontierGrammarId } = buildCurriculum(content, [...cards, unlock], {
      words: 0,
      practice: 1,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('grammar_cloze');
    expect(candidates[0]?.grammarIds).toEqual([frontierGrammarId]);
  });

  it('does not let a point with nothing to practise block later points', () => {
    const content = getContentIndex(createRepositories(t.db));
    // Fixture: 1 has no prerequisites; 2 and 3 need 1.
    expect(frontierGrammar(new Set(), content)).toBe(1);
    expect(frontierGrammar(new Set(), content, new Set([1, 2]))).toBe(1);
    expect(frontierGrammar(new Set(), content, new Set([2, 3]))).toBe(2);
    expect(frontierGrammar(new Set([2]), content, new Set([3]))).toBe(3);
    expect(frontierGrammar(new Set(), content, new Set())).toBeNull();
  });

  it('blanks the inflected form from sentence tokens', () => {
    const content = getContentIndex(createRepositories(t.db));
    const prompt = resolvePrompt({ kind: 'cloze_production', targetId: 1, reps: 0 }, content);
    expect(prompt?.kind).toBe('cloze_production');
    if (prompt?.kind !== 'cloze_production') return;
    // The shortest sentence with a form of essere: "Sei a casa?".
    expect(prompt.accepted).toEqual(['Sei']);
    expect(prompt.blank.before + prompt.blank.answer + prompt.blank.after).toBe(prompt.sentence.it);
  });
});
