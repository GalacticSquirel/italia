import { buildComprehensionCheck, type ComprehensionQuestion } from '@italia/core';

import type { Repositories } from '@/data';

import type { ReaderStory } from './storyModel';

/** Parts of speech worth blanking in a comprehension cloze. */
const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);

/** A stable 32-bit seed from a story id, so a story always gets the same check. */
export function seedFor(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The end-of-story check: three items built by core from the story's own sentences. */
export function comprehensionFor(repos: Repositories, story: ReaderStory): ComprehensionQuestion[] {
  const pos = new Map<number, string>();
  for (const s of story.sentences) {
    for (const t of s.tokens) {
      if (t.lemmaId === null || pos.has(t.lemmaId)) continue;
      const lemma = repos.lemmas.getById(t.lemmaId);
      if (lemma) pos.set(t.lemmaId, lemma.pos);
    }
  }
  return buildComprehensionCheck(story.sentences, {
    seed: seedFor(story.id),
    count: 3,
    posOf: (id) => pos.get(id),
    isContentWord: (id) => CONTENT_POS.has(pos.get(id) ?? ''),
    preferLemmaIds: new Set(story.targetLemmaIds),
  });
}
