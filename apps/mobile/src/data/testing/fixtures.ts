/** Test-only fixtures for the data layer. */
import { createScheduler, type CardSchedule } from '@italia/core';

import type { Seed } from '../seed/seedSchema';

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

/** A small, valid seed with `lemmaCount` lemmas and one sentence per lemma. */
export function makeSeed(version: Seed['version'], lemmaCount = 3): Seed {
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
    generatedAt: '2026-11-15T00:00:00.000Z',
    sources: [{ id: 'test', licence: 'CC0-1.0' }],
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
