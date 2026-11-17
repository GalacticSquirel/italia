/**
 * Story validator: checks a tagged story against its band (vocabulary, grammar
 * ceiling, length) using only the story file and the seed, so it runs in tests
 * without the lexicon.
 */
import { bandRules } from './bands';
import { type Story, type StorySeries } from './schema';
import { MAX_TARGETS, type StoryLemma, TARGET_MIN_RANK, tokenLemmaIds } from './tagger';
import { GRAMMAR_POINTS } from '../grammar/points';

/** Minimum share of counted tokens (names excluded) inside the band. */
export const MIN_IN_BAND = 0.98;
/** Fewest target lemmas a story must introduce. */
export const MIN_TARGETS = 3;
/** Names may not make up more than this share of a story's tokens. */
export const MAX_NAME_SHARE = 0.12;

export interface StoryReport {
  readonly id: string;
  readonly band: number;
  readonly wordCount: number;
  readonly nameTokens: number;
  /** Tokens counted for coverage (names excluded). */
  readonly countedTokens: number;
  /** Share of counted tokens whose lemmas are all within the band. */
  readonly inBand: number;
  /** Share of counted tokens from the next band (rank above the band, up to the next ceiling). */
  readonly nextBand: number;
  /** Tokens from the next band, as `form (lemma #rank)`. */
  readonly nextBandTokens: readonly string[];
  /** Tokens above the next band's ceiling. */
  readonly beyondNextBand: readonly string[];
  /** Tokens that are neither names nor seed lemmas. */
  readonly unknown: readonly string[];
  /** Grammar point slugs used. */
  readonly grammarUsed: readonly string[];
  /** Grammar point slugs used above the band's ceiling. */
  readonly grammarNotAllowed: readonly string[];
  readonly sentences: number;
  readonly longestSentence: number;
  readonly meanSentence: number;
  readonly errors: readonly string[];
}

const grammarById = new Map(GRAMMAR_POINTS.map((p, i) => [p.id, { slug: p.slug, order: i + 1 }]));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Validate one story. `lemmas` maps seed lemma id to its row. */
export function validateStory(story: Story, lemmas: ReadonlyMap<number, StoryLemma>): StoryReport {
  const rules = bandRules(story.band);
  const errors: string[] = [];
  const sentences = story.paragraphs.flatMap((p) => p.sentences);
  const tokens = sentences.flatMap((s) => s.tokens);

  const nextBandTokens: string[] = [];
  const beyondNextBand: string[] = [];
  const unknown: string[] = [];
  let nameTokens = 0;
  let inBandCount = 0;
  for (const t of tokens) {
    if (t.isName) {
      nameTokens++;
      continue;
    }
    const ids = tokenLemmaIds(t);
    if (ids.length === 0) {
      unknown.push(t.text);
      continue;
    }
    const rows = ids.map((id) => lemmas.get(id));
    if (rows.some((r) => !r)) {
      unknown.push(`${t.text} (id not in seed)`);
      continue;
    }
    const worst = rows.reduce((a, r) => ((r?.freqRank ?? 0) > (a?.freqRank ?? 0) ? r : a));
    const rank = worst?.freqRank ?? 0;
    const label = `${t.text} (${worst?.lemma ?? '?'} #${rank})`;
    if (rank <= rules.band) inBandCount++;
    else if (rank <= rules.next) nextBandTokens.push(label);
    else beyondNextBand.push(label);
  }
  const counted = tokens.length - nameTokens;
  const inBand = counted === 0 ? 0 : inBandCount / counted;
  const nextBand = counted === 0 ? 0 : nextBandTokens.length / counted;

  if (story.level !== rules.level) {
    errors.push(`level ${story.level} should be ${rules.level} for band ${story.band}`);
  }
  if (unknown.length > 0) errors.push(`untagged tokens: ${unknown.join(', ')}`);
  if (inBand < MIN_IN_BAND) {
    errors.push(
      `only ${pct(inBand)} of tokens within band ${story.band} (need ${pct(MIN_IN_BAND)}); ` +
        `next band: ${nextBandTokens.join(', ')}`,
    );
  }
  if (beyondNextBand.length > 0) {
    errors.push(`tokens above rank ${rules.next}: ${beyondNextBand.join(', ')}`);
  }
  if (nameTokens > tokens.length * MAX_NAME_SHARE) {
    errors.push(`names are ${pct(nameTokens / tokens.length)} of tokens`);
  }
  const [minWords, maxWords] = rules.words;
  if (story.wordCount < minWords || story.wordCount > maxWords) {
    errors.push(`${story.wordCount} words; band ${story.band} wants ${minWords}-${maxWords}`);
  }

  const grammarUsed: string[] = [];
  const grammarNotAllowed: string[] = [];
  for (const id of story.grammarIds) {
    const g = grammarById.get(id);
    if (!g) {
      errors.push(`unknown grammar id ${id}`);
      continue;
    }
    grammarUsed.push(g.slug);
    if (g.order > rules.maxGrammarOrder) grammarNotAllowed.push(g.slug);
  }
  if (grammarNotAllowed.length > 0) {
    const where = sentences
      .filter((s) =>
        s.grammarIds.some((id) => (grammarById.get(id)?.order ?? 0) > rules.maxGrammarOrder),
      )
      .map((s) => `"${s.it}"`);
    errors.push(
      `grammar above band ${story.band}: ${grammarNotAllowed.join(', ')} in ${where.join(' ')}`,
    );
  }
  const union = [...new Set(sentences.flatMap((s) => s.grammarIds))].sort((a, b) => a - b);
  if (union.join() !== story.grammarIds.join()) {
    errors.push('story grammarIds are not the union of its sentences');
  }

  const lengths = sentences.map((s) => s.tokens.length);
  const longestSentence = Math.max(...lengths);
  if (longestSentence > rules.maxSentenceWords) {
    const long = sentences.filter((s) => s.tokens.length > rules.maxSentenceWords);
    errors.push(
      `sentences over ${rules.maxSentenceWords} words: ${long.map((s) => `"${s.it}"`).join(' ')}`,
    );
  }

  const counts = new Map<number, number>();
  for (const t of tokens)
    for (const id of tokenLemmaIds(t)) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (story.targetLemmaIds.length < MIN_TARGETS || story.targetLemmaIds.length > MAX_TARGETS) {
    errors.push(
      `${story.targetLemmaIds.length} target lemmas (need ${MIN_TARGETS}-${MAX_TARGETS} words ` +
        `above rank ${Math.max(rules.previous, TARGET_MIN_RANK)} used at least twice)`,
    );
  }
  for (const id of story.targetLemmaIds) {
    const l = lemmas.get(id);
    if (
      !l ||
      l.freqRank <= Math.max(rules.previous, TARGET_MIN_RANK) ||
      (counts.get(id) ?? 0) < 2
    ) {
      errors.push(`target ${l?.lemma ?? id} is not a repeated new word for band ${story.band}`);
    }
  }

  return {
    id: story.id,
    band: story.band,
    wordCount: story.wordCount,
    nameTokens,
    countedTokens: counted,
    inBand,
    nextBand,
    nextBandTokens,
    beyondNextBand,
    unknown,
    grammarUsed,
    grammarNotAllowed,
    sentences: sentences.length,
    longestSentence,
    meanSentence: Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10,
    errors,
  };
}

/**
 * Corpus-level checks: unique ids, every story belongs to a listed series and
 * shares its band, and each series is numbered 1..n without gaps.
 */
export function validateCorpus(
  series: readonly StorySeries[],
  stories: readonly Story[],
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const s of stories) {
    if (ids.has(s.id)) errors.push(`duplicate story id ${s.id}`);
    ids.add(s.id);
  }
  const seriesIds = new Set<string>();
  for (const sr of series) {
    if (seriesIds.has(sr.id)) errors.push(`duplicate series id ${sr.id}`);
    seriesIds.add(sr.id);
    const episodes = stories.filter((s) => s.seriesId === sr.id);
    const indexes = episodes.map((s) => s.seriesIndex).sort((a, b) => a - b);
    if (indexes.length === 0 || indexes.some((n, i) => n !== i + 1)) {
      errors.push(`series ${sr.id} episodes are not numbered 1..n: ${indexes.join(',')}`);
    }
    for (const e of episodes) {
      if (e.band !== sr.band) errors.push(`${e.id} is band ${e.band}, series is ${sr.band}`);
    }
  }
  for (const s of stories) {
    if (!seriesIds.has(s.seriesId)) errors.push(`${s.id}: unknown series ${s.seriesId}`);
  }
  return errors;
}
