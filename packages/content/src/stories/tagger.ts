/**
 * Story tagger: tokenises story sentences, maps every token to seed lemma ids with
 * the Morph-it! lexicon (elision such as l', dell', c'è and enclitics such as
 * "dimmi", "alzarsi" come from the lexicon's normalisation), marks names, and
 * detects grammar with the same rules the seed sentences use.
 *
 * Pure: the build script loads the lexicon and SUBTLEX-IT from the source cache
 * and passes them in.
 */
import { bandRules, type StoryBand } from './bands';
import { type Story, type StorySentence, type StoryToken } from './schema';
import { type StorySource } from './source';
import { detectGrammar, usesOutOfScopeGrammar } from '../grammar/rules';
import { type PosDistribution } from '../pipeline/frequency';
import { type Lexicon, type Reading, type Unit, type Upos, unitKey } from '../pipeline/lexicon';
import { tagSentence, type TaggedToken } from '../pipeline/tagger';

/** The seed lemma fields the tagger and validator use. */
export interface StoryLemma {
  readonly id: number;
  readonly lemma: string;
  readonly pos: Upos;
  readonly freqRank: number;
}

export interface StoryTaggerInput {
  readonly lexicon: Lexicon;
  readonly subtlex: ReadonlyMap<string, PosDistribution>;
  readonly lemmas: readonly StoryLemma[];
  /**
   * Variant spellings the seed merged into a base word, `lemma|POS` -> base
   * (`ed|CCONJ` -> `e|CCONJ`, `po'|PRON` -> `poco|ADV`, `buon|ADJ` -> `buono|ADJ`).
   * The base is a `lemma|POS` key or a bare lemma. From
   * `seed/build-report.json`; see {@link parseVariantSpellings}.
   */
  readonly variants?: ReadonlyMap<string, string>;
}

/**
 * Parse the `lemmaPipeline.variantSpellings` lines of `seed/build-report.json`
 * (`"ed|CCONJ -> e|CCONJ"`, `"alcun|PRON -> alcuno (shown as)"`) into a map.
 */
export function parseVariantSpellings(lines: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of lines) {
    const m = /^(\S+\|[A-Z]+) -> (\S+)/.exec(line);
    if (m?.[1] && m[2]) out.set(m[1], m[2]);
  }
  return out;
}

/** Where a story sits: its series, episode number and band. */
export interface StoryPlacement {
  readonly seriesId: string;
  readonly seriesIndex: number;
  readonly band: StoryBand;
}

export interface TaggedStory {
  readonly story: Story;
  /** Problems only the tagger can see (validation covers the rest). */
  readonly issues: readonly string[];
}

/** Parts of speech that can be a story's target word. */
const CONTENT_POS: ReadonlySet<Upos> = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);
/** Most target lemmas a story lists. */
export const MAX_TARGETS = 6;
/**
 * The most frequent lemmas (articles, essere, avere, non...) are taught by the
 * grammar points, not as story targets.
 */
export const TARGET_MIN_RANK = 20;

/**
 * Map a lexicon unit to a seed lemma id: the exact `lemma|POS` key, or else the
 * same lemma under another part of speech (the seed folds homographs such as
 * `domani` noun/adverb into one lemma), preferring the more frequent one.
 */
export function createLemmaResolver(
  lemmas: readonly StoryLemma[],
  variants: ReadonlyMap<string, string> = new Map(),
): (unit: Unit) => number | null {
  const byKey = new Map<string, number>();
  const byLemma = new Map<string, StoryLemma>();
  for (const l of lemmas) {
    byKey.set(`${l.lemma}|${l.pos}`, l.id);
    const seen = byLemma.get(l.lemma);
    if (!seen || l.freqRank < seen.freqRank) byLemma.set(l.lemma, l);
  }
  const direct = (key: string, lemma: string) => byKey.get(key) ?? byLemma.get(lemma)?.id;
  return (unit) => {
    const key = unitKey(unit);
    const found = direct(key, unit.lemma);
    if (found !== undefined) return found;
    const base = variants.get(key);
    if (base === undefined) return null;
    return direct(base, base.split('|')[0] ?? base) ?? null;
  };
}

/** Create a tagger bound to one lexicon and seed. */
export function createStoryTagger({ lexicon, subtlex, lemmas, variants }: StoryTaggerInput) {
  const resolve = createLemmaResolver(lemmas, variants);
  const rankOf = new Map(lemmas.map((l) => [l.id, l]));
  const perRank = new Map(lemmas.map((l) => [`${l.lemma}|${l.pos}`, 1 / l.freqRank]));
  const readingIds = (r: Reading): number[] | null => {
    const ids: number[] = [];
    for (const u of r.units) {
      const id = resolve(u);
      if (id === null) return null;
      ids.push(id);
    }
    return ids;
  };

  /**
   * Tag one Italian sentence. `names` are the story's proper nouns; `readings`
   * pins the lemma of some lower-case spellings (see `StorySource.readings`).
   */
  function tagStorySentence(
    it: string,
    names: ReadonlySet<string>,
    readings: ReadonlyMap<string, string> = new Map(),
  ): { sentence: Omit<StorySentence, 'en'>; issues: string[] } {
    const raw = tagSentence(it, lexicon, subtlex, {
      allowed: (r, form) => {
        const pinned = readings.get(form);
        return readingIds(r) !== null && (pinned === undefined || r.units[0]?.lemma === pinned);
      },
      lemmaFrequency: (key) => perRank.get(key) ?? 0,
    });
    // Names never carry a reading, even when they are also words ("Rosa").
    const tagged: TaggedToken[] = raw.map((t) =>
      names.has(t.text) ? { ...t, reading: null, properNoun: true } : t,
    );
    const issues: string[] = [];
    const tokens: StoryToken[] = tagged.map((t) => {
      const base = { text: t.text, start: t.start, end: t.end };
      if (names.has(t.text)) return { ...base, lemmaId: null, isName: true };
      const ids = t.reading ? readingIds(t.reading) : null;
      const [head, ...parts] = ids ?? [];
      if (head === undefined) {
        issues.push(
          t.properNoun
            ? `"${t.text}" looks like a name: add it to "names:" or use another word`
            : `"${t.text}" is not a seed lemma`,
        );
        return { ...base, lemmaId: null };
      }
      return parts.length > 0
        ? { ...base, lemmaId: head, partIds: parts }
        : { ...base, lemmaId: head };
    });
    if (usesOutOfScopeGrammar(tagged)) {
      issues.push(`subjunctive or passato remoto form in "${it}"`);
    }
    return { sentence: { it, tokens, grammarIds: detectGrammar(it, tagged) }, issues };
  }

  /**
   * Tag a whole story source into a {@link Story}. `taught` holds the targets of
   * earlier episodes, which are only picked again when there are not enough new
   * words.
   */
  function tagStory(
    source: StorySource,
    placement: StoryPlacement,
    { taught = new Set<number>() }: { taught?: ReadonlySet<number> } = {},
  ): TaggedStory {
    const rules = bandRules(placement.band);
    const names = new Set(source.names);
    const issues: string[] = [];
    const paragraphs = source.paragraphs.map((p) => ({
      sentences: p.map(({ it, en }) => {
        const { sentence, issues: found } = tagStorySentence(
          normaliseApostrophes(it),
          names,
          source.readings,
        );
        issues.push(...found);
        return { it: sentence.it, en, tokens: sentence.tokens, grammarIds: sentence.grammarIds };
      }),
    }));
    const tagText = ({ it, en }: { it: string; en: string }) => {
      const { sentence, issues: found } = tagStorySentence(
        normaliseApostrophes(it),
        names,
        source.readings,
      );
      issues.push(...found.map((f) => `question: ${f}`));
      return { it: sentence.it, en, tokens: sentence.tokens, grammarIds: sentence.grammarIds };
    };
    const questions = source.questions.map((q) => ({
      prompt: tagText(q.prompt),
      options: q.options.map(tagText),
      answer: q.answer,
    }));
    const sentences = paragraphs.flatMap((p) => p.sentences);
    const tokens = sentences.flatMap((s) => s.tokens);
    const allTokens = [
      ...tokens,
      ...questions.flatMap((q) => [q.prompt, ...q.options].flatMap((x) => x.tokens)),
    ];
    for (const [form, lemma] of source.readings) {
      const used = allTokens.some(
        (t) =>
          t.text.toLowerCase() === form &&
          t.lemmaId !== null &&
          rankOf.get(t.lemmaId)?.lemma === lemma,
      );
      if (!used) issues.push(`readings: "${form}=${lemma}" matches no word of the story`);
    }

    const counts = new Map<number, number>();
    for (const t of tokens) {
      for (const id of tokenLemmaIds(t)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const targetLemmaIds = [...counts.entries()]
      .map(([id, n]) => ({ id, n, lemma: rankOf.get(id) }))
      .filter(
        (x) =>
          x.n >= 2 &&
          !!x.lemma &&
          x.lemma.freqRank > Math.max(rules.previous, TARGET_MIN_RANK) &&
          CONTENT_POS.has(x.lemma.pos),
      )
      .sort(
        (a, b) =>
          Number(taught.has(a.id)) - Number(taught.has(b.id)) ||
          b.n - a.n ||
          (b.lemma?.freqRank ?? 0) - (a.lemma?.freqRank ?? 0),
      )
      .slice(0, MAX_TARGETS)
      .map((x) => x.id);

    const story: Story = {
      id: `${placement.seriesId}-${String(placement.seriesIndex).padStart(2, '0')}`,
      seriesId: placement.seriesId,
      seriesIndex: placement.seriesIndex,
      level: rules.level,
      band: placement.band,
      title: { it: normaliseApostrophes(source.title.it), en: source.title.en },
      paragraphs,
      targetLemmaIds,
      grammarIds: [...new Set(sentences.flatMap((s) => s.grammarIds))].sort((a, b) => a - b),
      questions,
      wordCount: tokens.length,
    };
    return { story, issues };
  }

  return { tagStorySentence, tagStory };
}

/** Every lemma id a token stands for (head first). */
export function tokenLemmaIds(t: StoryToken): number[] {
  return t.lemmaId === null ? [] : [t.lemmaId, ...(t.partIds ?? [])];
}

/** Story sources use the ASCII apostrophe so token text equals the sentence slice. */
export function normaliseApostrophes(text: string): string {
  return text.replace(/[’ʼ]/g, "'");
}
