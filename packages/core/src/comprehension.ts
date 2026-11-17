import { createRng, shuffle, type Rng } from './rng';

/** A word token of a story sentence (UTF-16 offsets into `it`, end exclusive). */
export interface ComprehensionToken {
  start: number;
  end: number;
  lemmaId: number | null;
  isName?: boolean;
}

/** A story sentence with its translation. */
export interface ComprehensionSentence {
  it: string;
  en: string;
  tokens: readonly ComprehensionToken[];
}

/** Choose the missing word of a story sentence. */
export interface ClozeQuestion {
  kind: 'cloze';
  /** Index of the sentence in the story (reading order). */
  sentenceIndex: number;
  /** Sentence text before the blank. */
  before: string;
  /** Sentence text after the blank. */
  after: string;
  /** The missing word as written in the story. */
  answer: string;
  /** Answer and distractors, shuffled; all distinct ignoring case. */
  options: string[];
  /** English translation of the sentence, shown after answering. */
  translation: string;
}

/** Decide whether an English sentence translates an Italian one from the story. */
export interface TrueFalseQuestion {
  kind: 'true_false';
  sentenceIndex: number;
  /** The Italian sentence. */
  it: string;
  /** The proposed translation. */
  claim: string;
  /** Whether `claim` is the sentence's translation. */
  answer: boolean;
  /** The correct translation, shown after answering. */
  translation: string;
}

/** One item of a comprehension check. */
export type ComprehensionQuestion = ClozeQuestion | TrueFalseQuestion;

/** Options for {@link buildComprehensionCheck}. */
export interface ComprehensionOptions {
  /** Seed for the deterministic choices (for example a hash of the story id). Defaults to 0. */
  seed?: number;
  /** Items to build. Defaults to 3. */
  count?: number;
  /**
   * Whether a lemma is a content word worth blanking (noun, verb, adjective,
   * adverb). Defaults to every lemma.
   */
  isContentWord?: (lemmaId: number) => boolean;
  /** Part of speech of a lemma, so distractors match the answer's. */
  posOf?: (lemmaId: number) => string | undefined;
  /** Lemmas to prefer as blanks (the story's target words). */
  preferLemmaIds?: ReadonlySet<number>;
}

/** Fewest words a sentence needs to be used for a cloze item. */
const MIN_CLOZE_WORDS = 4;
/** Shortest word form worth blanking. */
const MIN_BLANK_LENGTH = 3;
/** Options per cloze item (the answer plus distractors). */
const CLOZE_OPTIONS = 4;

const lower = (s: string) => s.toLocaleLowerCase('it');

/**
 * Build a short comprehension check from a story's own sentences: cloze items
 * (pick the missing word, with distractors taken from other words of the same
 * story) and a true/false item (does this English sentence translate that
 * Italian one? A false claim is the translation of a different sentence of the
 * story). Items come from different parts of the story, in reading order, and
 * the last of every three items is the true/false one. Deterministic for a
 * given seed.
 *
 * Returns fewer items when the story is too short to build them all.
 */
export function buildComprehensionCheck(
  sentences: readonly ComprehensionSentence[],
  options: ComprehensionOptions = {},
): ComprehensionQuestion[] {
  const count = options.count ?? 3;
  if (!(Number.isInteger(count) && count >= 0)) {
    throw new RangeError('count must be a non-negative integer');
  }
  const rng = createRng(options.seed ?? 0);
  const isContent = options.isContentWord ?? (() => true);
  const kinds = Array.from({ length: count }, (_, i) =>
    i % 3 === 2 ? ('true_false' as const) : ('cloze' as const),
  );

  const used = new Set<number>();
  const items: ComprehensionQuestion[] = [];
  kinds.forEach((kind, i) => {
    // Spread items over the story: item i draws from the i-th part first.
    const parts = sectionOrder(sentences.length, count, i);
    for (const index of parts) {
      if (used.has(index)) continue;
      const item =
        kind === 'cloze'
          ? clozeItem(sentences, index, rng, isContent, options)
          : trueFalseItem(sentences, index, rng);
      if (item) {
        used.add(index);
        items.push(item);
        return;
      }
    }
  });
  return items.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
}

/** Sentence indexes to try for item `i` of `count`: its own section first, then the rest. */
function sectionOrder(length: number, count: number, i: number): number[] {
  if (length === 0) return [];
  const size = length / Math.max(1, count);
  const from = Math.floor(i * size);
  const to = Math.max(from + 1, Math.floor((i + 1) * size));
  const own: number[] = [];
  for (let k = from; k < Math.min(to, length); k++) own.push(k);
  const rest: number[] = [];
  for (let k = 0; k < length; k++) if (k < from || k >= to) rest.push(k);
  return [...own, ...rest];
}

function clozeItem(
  sentences: readonly ComprehensionSentence[],
  index: number,
  rng: Rng,
  isContent: (lemmaId: number) => boolean,
  options: ComprehensionOptions,
): ClozeQuestion | null {
  const sentence = sentences[index];
  if (!sentence || sentence.tokens.length < MIN_CLOZE_WORDS) return null;
  const formOf = (t: ComprehensionToken, s: ComprehensionSentence) => s.it.slice(t.start, t.end);
  const blanks = sentence.tokens.filter(
    (t): t is ComprehensionToken & { lemmaId: number } =>
      t.lemmaId !== null &&
      t.isName !== true &&
      t.end - t.start >= MIN_BLANK_LENGTH &&
      isContent(t.lemmaId),
  );
  if (blanks.length === 0) return null;
  const preferred = blanks.filter((t) => options.preferLemmaIds?.has(t.lemmaId) === true);
  const pool = preferred.length > 0 ? preferred : blanks;
  const blank = pool[Math.floor(rng() * pool.length)];
  if (!blank) return null;
  const answer = formOf(blank, sentence);
  const pos = options.posOf?.(blank.lemmaId);

  // Distractors: other word forms of the story, same part of speech first.
  const seen = new Set([lower(answer)]);
  const samePos: string[] = [];
  const otherPos: string[] = [];
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (t.lemmaId === null || t.isName === true || t.lemmaId === blank.lemmaId) continue;
      if (t.end - t.start < MIN_BLANK_LENGTH || !isContent(t.lemmaId)) continue;
      const form = formOf(t, s);
      if (seen.has(lower(form))) continue;
      seen.add(lower(form));
      if (pos !== undefined && options.posOf?.(t.lemmaId) === pos) samePos.push(form);
      else otherPos.push(form);
    }
  }
  const distractors = [...shuffle(samePos, rng), ...shuffle(otherPos, rng)].slice(
    0,
    CLOZE_OPTIONS - 1,
  );
  if (distractors.length === 0) return null;
  return {
    kind: 'cloze',
    sentenceIndex: index,
    before: sentence.it.slice(0, blank.start),
    after: sentence.it.slice(blank.end),
    answer,
    options: shuffle([answer, ...distractors], rng),
    translation: sentence.en,
  };
}

function trueFalseItem(
  sentences: readonly ComprehensionSentence[],
  index: number,
  rng: Rng,
): TrueFalseQuestion | null {
  const sentence = sentences[index];
  if (!sentence) return null;
  const others = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== index && lower(s.en) !== lower(sentence.en));
  const truth = others.length === 0 || rng() < 0.5;
  const other = truth ? undefined : others[Math.floor(rng() * others.length)];
  return {
    kind: 'true_false',
    sentenceIndex: index,
    it: sentence.it,
    claim: other ? other.s.en : sentence.en,
    answer: other === undefined,
    translation: sentence.en,
  };
}
