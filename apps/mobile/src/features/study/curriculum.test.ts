import type { GrammarDrill } from '@italia/content';
import { createScheduler } from '@italia/core';

import { cardIdFor, createRepositories, importSeedContent, type CardRow } from '@/data';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';

import { buildContentIndex, getContentIndex, type ContentIndex } from './content';
import { buildCurriculum, frontierGrammar, grammarLevelOpen } from './curriculum';
import { resolvePrompt, SPOKEN_PROMPT_MAX_WORDS, wordCount } from './prompts';

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
  flagUpdatedAt: null,
  flagDeviceId: null,
  flagSyncedAt: null,
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

  it('introduces words the learner asked for first, oldest request first', () => {
    const content = getContentIndex(createRepositories(t.db));
    const requested = (targetId: number, at: number): CardRow => ({
      ...introduced('cloze_production', targetId),
      state: 'new',
      reps: 0,
      createdAt: new Date(at),
    });
    const { candidates } = buildCurriculum(content, [requested(30, 2), requested(20, 1)], {
      words: 3,
      practice: 0,
    });
    expect(candidates.map((c) => c.id)).toEqual([
      'recognition:20:typed',
      'recognition:30:typed',
      'cloze_production:20:typed',
      'recognition:1:typed',
      'cloze_production:30:typed',
      'cloze_production:1:typed',
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

  it('adds short known sentences as spoken prompts, up to the speaking limit', () => {
    const content = getContentIndex(createRepositories(t.db));
    const recognised = content.lemmas.map((l) => introduced('recognition', l.id));
    const frontier = buildCurriculum(content, recognised, { words: 0, practice: 1 });
    const unlock = introduced('grammar_cloze', frontier.candidates[0]?.targetId ?? 0);
    const words = [...recognised, unlock];
    const none = buildCurriculum(content, words, { words: 0, practice: 0 });
    expect(none.unlockedGrammarIds.size).toBeGreaterThan(0);
    expect(none.candidates.some((c) => c.kind === 'spoken_prompt')).toBe(false);

    const { candidates } = buildCurriculum(content, words, { words: 0, practice: 0, speaking: 2 });
    const spoken = candidates.filter((c) => c.kind === 'spoken_prompt');
    expect(spoken).toHaveLength(2);
    for (const c of spoken) {
      expect(c.id).toBe(`spoken_prompt:${String(c.targetId)}:spoken`);
      const prompt = resolvePrompt({ ...c, reps: 0 }, content);
      expect(prompt?.kind).toBe('spoken_prompt');
      if (prompt?.kind !== 'spoken_prompt') continue;
      expect(wordCount(prompt.sentence.it)).toBeLessThanOrEqual(SPOKEN_PROMPT_MAX_WORDS);
      expect(c.grammarIds.every((g) => none.unlockedGrammarIds.has(g))).toBe(true);
    }

    // Words not yet introduced: no spoken prompts.
    const fresh = buildCurriculum(content, [], { words: 0, practice: 0, speaking: 2 });
    expect(fresh.candidates.some((c) => c.kind === 'spoken_prompt')).toBe(false);
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

  describe('with hand-written drills', () => {
    const drill = (pointId: number, n: number): GrammarDrill => ({
      id: pointId * 100 + n,
      pointId,
      before: 'Io ',
      answer: 'sono',
      after: ' qui.',
      it: 'Io sono qui.',
      en: 'I am here.',
      hint: 'essere',
      accepted: ['sono'],
    });
    const withDrills = (base: ContentIndex, drills: GrammarDrill[]) =>
      buildContentIndex(base.lemmas, [...base.sentenceById.values()], base.grammar, [], drills);
    // The fixture's grammar titles differ from the syllabus, so drills are given
    // for its points by building the index with them directly.
    const content = () => {
      const base = getContentIndex(createRepositories(t.db));
      const drills = [1, 2, 3].flatMap((p) => [1, 2, 3, 4, 5].map((n) => drill(p, n)));
      const index = withDrills(base, drills);
      return {
        ...index,
        drillsByPoint: new Map([1, 2, 3].map((p) => [p, drills.filter((d) => d.pointId === p)])),
        drillById: new Map(drills.map((d) => [d.id, d])),
      };
    };

    it('drops drills whose point in the seed is a different point', () => {
      const base = getContentIndex(createRepositories(t.db));
      expect(withDrills(base, [drill(1, 1)]).drillById.size).toBe(0);
    });

    it('teaches the frontier with its drills before any word is known', () => {
      const index = content();
      const first = buildCurriculum(index, [], { words: 0, practice: 10 });
      expect(first.frontierGrammarId).toBe(1);
      const drills = first.candidates.filter((c) => c.kind === 'grammar_drill');
      expect(drills.map((c) => c.targetId)).toEqual([101, 102, 103]);
      expect(drills.every((c) => c.grammarIds[0] === 1 && c.lemmaIds.length === 0)).toBe(true);
      const item = drills[0];
      if (!item) throw new Error('no drill');
      const prompt = resolvePrompt({ ...item, reps: 0 }, index);
      expect(prompt?.kind).toBe('grammar_drill');
      if (prompt?.kind !== 'grammar_drill') return;
      expect(prompt.blank).toEqual({ before: 'Io ', answer: 'sono', after: ' qui.' });
      expect(prompt.grammarPoint?.id).toBe(1);
    });

    it('unlocks a point with one answered drill and keeps practising its other drills', () => {
      const index = content();
      const cards = [introduced('grammar_drill', 101)];
      const next = buildCurriculum(index, cards, { words: 0, practice: 10 });
      expect([...next.unlockedGrammarIds]).toEqual([1]);
      expect(next.frontierGrammarId).toBe(2);
      const ids = next.candidates.filter((c) => c.kind === 'grammar_drill').map((c) => c.targetId);
      // Three frontier drills for point 2, then the remaining drills of point 1.
      expect(ids).toEqual([201, 202, 203, 102, 103, 104]);
    });

    it('gates later levels on words met', () => {
      // Point ids outside the syllabus are never gated.
      expect(grammarLevelOpen(9999, 0)).toBe(true);
      // Syllabus point 38 (conditional) is B1: 500 words.
      expect(grammarLevelOpen(38, 499)).toBe(false);
      expect(grammarLevelOpen(38, 500)).toBe(true);
      expect(grammarLevelOpen(1, 0)).toBe(true);
    });
  });
});
