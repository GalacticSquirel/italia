/** Test-only fixtures for the data layer. */
import type { Seed } from '@italia/content';
import { createScheduler, type CardSchedule } from '@italia/core';

import type { SeedContent } from '../seed/seedContent';

/** A fixed reference time for tests. */
export const T0 = new Date('2026-11-01T08:00:00.000Z');

/** `T0` plus `minutes`. */
export function at(minutes: number): Date {
  return new Date(T0.getTime() + minutes * 60_000);
}

/** A new-card schedule due at `now`, with overrides. */
export function schedule(overrides: Partial<CardSchedule> = {}, now: Date = T0): CardSchedule {
  return { ...createScheduler().newCard(now), ...overrides };
}

/**
 * Small, valid seed content (already mapped to app rows) with `lemmaCount`
 * lemmas and one sentence per lemma.
 */
export function makeSeed(
  version: SeedContent['version'],
  lemmaCount = 3,
  generatedAt = '2026-11-15T00:00:00.000Z',
): SeedContent {
  const lemmas = Array.from({ length: lemmaCount }, (_, i) => ({
    id: i + 1,
    lemma: `parola${String(i + 1)}`,
    pos: 'NOUN',
    freqRank: i + 1,
    glossEn: `word ${String(i + 1)}`,
    audioRef: null,
  }));
  return {
    version,
    generatedAt,
    grammarPoints: [
      { id: 1, title: 'Presente', order: 1, prerequisiteIds: [], noteMd: 'Present tense.' },
      { id: 2, title: 'Passato prossimo', order: 2, prerequisiteIds: [1], noteMd: 'Perfect.' },
    ],
    lemmas,
    sentences: lemmas.map((l) => ({
      id: l.id,
      it: `Questa è la ${l.lemma}.`,
      en: `This is ${l.glossEn}.`,
      lemmaIds: [l.id],
      grammarIds: [1],
      source: `test:${String(l.id)}`,
      licence: 'CC0-1.0',
    })),
  };
}

/**
 * A small seed in the canonical `@italia/content` format (with `extra`), for
 * testing the mapping: "Il gatto è nel giardino." (with the articulated
 * preposition "nel" = in + il) and "Mario mangia." (a name, no lemma).
 */
export function makeCanonicalSeed(generatedAt = '2026-11-15T00:00:00.000Z'): Seed {
  const lemma = (
    id: number,
    headword: string,
    pos: Seed['lemmas'][number]['pos'],
    gloss: string,
  ) => ({
    id,
    lemma: headword,
    pos,
    freqRank: id,
    glossEn: gloss,
    audioRef: null,
    extra: { perMillion: 1000 / id, ...(pos === 'NOUN' ? { gender: 'm' as const } : {}) },
  });
  const sentenceExtra = {
    anchor: true,
    enSentenceId: 99,
    itAuthor: 'someone',
    enAuthor: null,
  };
  return {
    version: 1,
    generatedAt,
    sources: [
      {
        id: 'test-source',
        name: 'Test source',
        url: 'https://example.org/data.tar.bz2',
        homepage: 'https://example.org/',
        licence: 'CC-BY-2.0-FR',
        sha256: 'a'.repeat(64),
        bytes: 1,
        fetchedAt: '2026-11-01T00:00:00.000Z',
        usedFor: 'tests',
      },
    ],
    lemmas: [
      lemma(1, 'il', 'DET', 'the'),
      lemma(2, 'essere', 'VERB', 'to be'),
      lemma(3, 'in', 'ADP', 'in'),
      lemma(4, 'gatto', 'NOUN', 'cat'),
      lemma(5, 'giardino', 'NOUN', 'garden'),
      lemma(6, 'mangiare', 'VERB', 'to eat'),
    ],
    sentences: [
      {
        id: 101,
        it: 'Il gatto è nel giardino.',
        en: 'The cat is in the garden.',
        lemmaIds: [1, 4, 2, 3, 5],
        grammarIds: [1],
        source: 'tatoeba:101',
        licence: 'CC-BY-2.0-FR',
        extra: {
          ...sentenceExtra,
          targetLemmaId: 5,
          difficulty: 5,
          tokens: [
            [0, 2, 0],
            [3, 8, 1],
            [9, 10, 2],
            [11, 14, 3, 0],
            [15, 23, 4],
          ],
        },
      },
      {
        id: 102,
        it: 'Mario mangia.',
        en: 'Mario eats.',
        lemmaIds: [6],
        grammarIds: [2],
        source: 'tatoeba:102',
        licence: 'CC-BY-2.0-FR',
        extra: {
          ...sentenceExtra,
          targetLemmaId: 6,
          difficulty: 6,
          tokens: [
            [0, 5],
            [6, 12, 0],
          ],
        },
      },
    ],
    grammarPoints: [
      {
        id: 1,
        title: 'Essere',
        order: 1,
        prerequisiteIds: [],
        noteMd: 'Essere means to be.',
        extra: { slug: 'essere', cefr: 'A1' },
      },
      {
        id: 2,
        title: 'Present tense',
        order: 2,
        prerequisiteIds: [1],
        noteMd: 'Regular verbs.',
        extra: { slug: 'present', cefr: 'A1' },
      },
    ],
  };
}
