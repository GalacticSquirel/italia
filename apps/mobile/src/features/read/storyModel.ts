/**
 * The reader's view of a stored story: its sentences in reading order, with
 * the word tokens, and helpers for coverage and exposure counting.
 */
import type { CoverageToken } from '@italia/core';

import { storyBodyOf, type StoredSeries, type StoryRow, type StorySentence } from '@/data';

/** One sentence of a story, in reading order. */
export interface ReaderSentence extends StorySentence {
  /** Index in reading order (paragraphs flattened). */
  index: number;
  /** Paragraph the sentence belongs to. */
  paragraph: number;
}

/** A story ready to read. */
export interface ReaderStory {
  id: string;
  level: StoryRow['level'];
  band: number;
  seriesId: string;
  seriesIndex: number;
  /** Italian title. */
  title: string;
  titleEn: string;
  series: StoredSeries;
  sentences: ReaderSentence[];
  targetLemmaIds: readonly number[];
  wordCount: number;
}

/** The reader model of a stored story, or null when it cannot be read. */
export function toReaderStory(row: StoryRow): ReaderStory | null {
  const body = storyBodyOf(row);
  if (!body || row.seriesId === null || row.seriesIndex === null) return null;
  let index = 0;
  const sentences = body.paragraphs.flatMap((p, paragraph) =>
    p.sentences.map((s) => ({ ...s, index: index++, paragraph })),
  );
  return {
    id: row.id,
    level: row.level,
    band: body.band,
    seriesId: row.seriesId,
    seriesIndex: row.seriesIndex,
    title: row.title,
    titleEn: body.titleEn,
    series: body.series,
    sentences,
    targetLemmaIds: body.targetLemmaIds,
    wordCount: body.wordCount,
  };
}

/** Lemma ids of a token: its head lemma and any packed ones ("nel" is in + il). */
export function tokenLemmaIds(token: StorySentence['tokens'][number]): number[] {
  return token.lemmaId === null ? [] : [token.lemmaId, ...(token.partIds ?? [])];
}

/** The story's word tokens for core's coverage. */
export function coverageTokens(story: ReaderStory): CoverageToken[] {
  return story.sentences.flatMap((s) =>
    s.tokens.map((t) => ({
      lemmaId: t.lemmaId,
      ...(t.partIds ? { partIds: t.partIds } : {}),
      ...(t.isName ? { properNoun: true } : {}),
    })),
  );
}

/** How many times each lemma occurs in the story (packed lemmas included). */
export function lemmaOccurrences(story: ReaderStory): Map<number, number> {
  const counts = new Map<number, number>();
  for (const s of story.sentences) {
    for (const t of s.tokens) {
      for (const id of tokenLemmaIds(t)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Rough reading-while-listening time for a learner: about 70 words a minute. */
export const READING_WORDS_PER_MINUTE = 70;

/** Estimated minutes to read and listen to a story once (at least 1). */
export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / READING_WORDS_PER_MINUTE));
}
