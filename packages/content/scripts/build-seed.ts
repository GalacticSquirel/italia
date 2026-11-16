/**
 * Build `seed/seed.v1.json` from the cached sources.
 *
 * Usage: `pnpm --filter @italia/content build:seed [--refresh]`
 *
 * Steps: verify sources -> Morph-it! lexicon -> lemma frequencies from
 * FrequencyWords (POS split by SUBTLEX-IT) -> Wiktionary glosses -> top lemmas ->
 * Tatoeba it-en pairs, tagged and scored -> n+1 sentence selection -> grammar
 * tags -> validated seed + build report.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { cachePath, ensureSources, PACKAGE_DIR, sourceById } from './cache';
import { readMorphIt, run } from './morph-it';
import { serialiseSeed } from './serialise-seed';
import { SOURCES, type SourceId } from './sources';
import { detectGrammar, usesOutOfScopeGrammar } from '../src/grammar/rules';
import { grammarSeedRows } from '../src/grammar/seedRows';
import {
  countLemmas,
  ghostLemmas,
  mergeHomographs,
  parseFrequencyWords,
  parseSubtlex,
  properNounShare,
  readingPriors,
  shadowedLemmas,
  tokenCoverage,
} from '../src/pipeline/frequency';
import {
  pickGloss,
  variantOf,
  WIKTIONARY_POS,
  type WiktionaryEntry,
} from '../src/pipeline/glosses';
import { lemmaId } from '../src/pipeline/ids';
import {
  applyFormReadings,
  dropReadings,
  lookup,
  parseUnitKey,
  parseMorphIt,
  type Reading,
  unitKey,
} from '../src/pipeline/lexicon';
import {
  BLOCKED_LEMMAS,
  EXCLUDED_TOP_FORMS,
  FORM_READINGS,
  GLOSS_OVERRIDES,
  LEXICON_SUPPLEMENT,
  PREFERRED_POS,
  SINGLE_LETTER_WORDS,
} from '../src/pipeline/overrides';
import { type Candidate, selectSentences } from '../src/pipeline/select';
import { tagSentence } from '../src/pipeline/tagger';
import {
  type Seed,
  type SeedGrammarPoint,
  type SeedLemma,
  SeedSchema,
  type SeedSentence,
  type SeedSource,
  SEED_VERSION,
} from '../src/schema';

const LEMMA_COUNT = 3000;
const COVERAGE_LEVELS = [1000, 2000, 3000, 5000];
const MIN_TOKENS = 3;
const MAX_TOKENS = 12;
const MAX_PROPER_NOUNS = 2;
const SEED_DIR = join(PACKAGE_DIR, 'seed');
const SEED_PATH = join(SEED_DIR, `seed.v${SEED_VERSION}.json`);
const REPORT_PATH = join(SEED_DIR, 'build-report.json');
const TOP_FORMS_PATH = join(SEED_DIR, 'top-forms.json');
/** How many of the most frequent word forms the regression fixture records. */
const TOP_FORMS = 300;

const USED_FOR: Readonly<Record<SourceId, string>> = {
  'frequencywords-it': 'Word-form frequencies (lemma ranks after lemmatisation)',
  'morph-it': 'Lemmatisation and morphology (form to lemma, POS, gender, tense)',
  'subtlex-it': 'POS distribution per form, to split ambiguous form counts',
  'kaikki-it': 'English glosses',
  'tatoeba-ita': 'Italian example sentences',
  'tatoeba-eng': 'English translations',
  'tatoeba-ita-eng-links': 'Italian-English translation links',
  'tatoeba-user-languages': 'Native-speaker flags used to rank sentences',
};

const log = (message: string) => {
  console.log(`[build-seed] ${message}`);
};

// ---------------------------------------------------------------------------
// IO helpers
// ---------------------------------------------------------------------------

/** Stream the lines of a .bz2 file (needs the `bzip2` command). */
async function* bz2Lines(path: string): AsyncGenerator<string> {
  const child = spawn('bzip2', ['-dc', path]);
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

async function readWiktionary(words: ReadonlySet<string>): Promise<Map<string, WiktionaryEntry[]>> {
  const out = new Map<string, WiktionaryEntry[]>();
  const rl = createInterface({
    input: createReadStream(cachePath('kaikki-it'), 'utf8'),
    crlfDelay: Infinity,
  });
  const top = /"word": "((?:[^"\\]|\\.)*)", "lang": "Italian"/;
  for await (const line of rl) {
    const m = top.exec(line);
    if (!m?.[1]) continue;
    const word = JSON.parse(`"${m[1]}"`) as string;
    if (!words.has(word)) continue;
    const entry = JSON.parse(line) as WiktionaryEntry;
    if (entry.word !== word) continue;
    let list = out.get(word);
    if (!list) out.set(word, (list = []));
    list.push({
      word,
      pos: entry.pos,
      senses: (entry.senses ?? []).map((s) => ({
        ...(s.glosses ? { glosses: s.glosses } : {}),
        ...(s.tags ? { tags: s.tags } : {}),
        ...(s.alt_of ? { alt_of: s.alt_of.map((a) => ({ word: a.word })) } : {}),
        ...(s.form_of ? { form_of: s.form_of.map((a) => ({ word: a.word })) } : {}),
      })),
    });
  }
  return out;
}

interface TatoebaSentence {
  id: number;
  text: string;
  author: string | null;
}

async function readTatoeba(
  path: string,
  keep?: ReadonlySet<number>,
): Promise<Map<number, TatoebaSentence>> {
  const out = new Map<number, TatoebaSentence>();
  for await (const line of bz2Lines(path)) {
    const [idText, , text, author] = line.split('\t');
    const id = Number(idText);
    if (!Number.isInteger(id) || !text) continue;
    if (keep && !keep.has(id)) continue;
    out.set(id, { id, text: text.trim(), author: author && author !== '\\N' ? author : null });
  }
  return out;
}

async function readNativeSpeakers(): Promise<{ ita: Set<string>; eng: Set<string> }> {
  const text = (await run('tar', ['-xjOf', cachePath('tatoeba-user-languages')])).toString('utf8');
  const ita = new Set<string>();
  const eng = new Set<string>();
  for (const line of text.split('\n')) {
    const [lang, level, user] = line.split('\t');
    if (level !== '5' || !user) continue;
    if (lang === 'ita') ita.add(user);
    if (lang === 'eng') eng.add(user);
  }
  return { ita, eng };
}

// ---------------------------------------------------------------------------
// Lemmas
// ---------------------------------------------------------------------------

const VALID_LEMMA = /^\p{Ll}[\p{Ll}']*$/u;

/** Wiktextract parts of speech, with the nominal ones (noun, adj, det, pron) as one. */
const posClass = (pos: string): string =>
  ['noun', 'adj', 'det', 'pron', 'num', 'article'].includes(pos) ? 'nominal' : pos;

function eligibleKey(key: string): boolean {
  const [lemma = '', upos = ''] = key.split('|');
  if (upos === 'PROPN') return false;
  if (!VALID_LEMMA.test(lemma)) return false;
  if (lemma.length === 1 && !SINGLE_LETTER_WORDS.has(lemma)) return false;
  return !BLOCKED_LEMMAS.has(lemma);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const lock = await ensureSources({ refresh: process.argv.includes('--refresh') }, log);

  log('lexicon');
  const lexicon = parseMorphIt(`${await readMorphIt()}\n${LEXICON_SUPPLEMENT}`);
  applyFormReadings(lexicon, FORM_READINGS);
  const subtlex = parseSubtlex(await readFile(cachePath('subtlex-it'), 'latin1'));
  const formCounts = parseFrequencyWords(await readFile(cachePath('frequencywords-it'), 'utf8'));

  log('lemma frequencies');
  // Lemmas that only exist as a misreading of one frequent form (vaio from "vai")
  // are removed from that form before counting.
  const ghosts = ghostLemmas(countLemmas(formCounts, lexicon, subtlex), formCounts);
  dropReadings(lexicon, ghosts);
  log(`ghost lemmas: ${[...ghosts].sort().join(' ')}`);
  const firstPass = countLemmas(formCounts, lexicon, subtlex);
  const canonical = mergeHomographs(firstPass.counts, { preferred: PREFERRED_POS });
  const counted = countLemmas(formCounts, lexicon, subtlex, { canonical });
  const shadowed = shadowedLemmas(counted, new Set(['VERB', 'ADJ']));
  const candidates = [...counted.counts.entries()]
    .filter(([key]) => eligibleKey(key) && !shadowed.has(key))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 9000);
  const candidateCount = new Map(candidates);

  // Members of each merged homograph group, most frequent first.
  const members = new Map<string, string[]>();
  for (const key of [...firstPass.counts.keys()].sort(
    (a, b) => (firstPass.counts.get(b) ?? 0) - (firstPass.counts.get(a) ?? 0) || a.localeCompare(b),
  )) {
    const root = canonical(key);
    if (!candidateCount.has(root)) continue;
    let list = members.get(root);
    if (!list) members.set(root, (list = [root]));
    if (key !== root) list.push(key);
  }

  log('glosses');
  const wiktionary = await readWiktionary(new Set(candidates.map(([k]) => parseUnitKey(k).lemma)));
  const entriesOf = (lemma: string) => wiktionary.get(lemma) ?? [];
  const dropped = { noGloss: 0, offensive: 0, shadowed: shadowed.size };
  /** Key -> the key it was folded into (variant spelling, chosen POS, same meaning). */
  const alias = new Map<string, string>();
  const resolve = (key: string): string => {
    let k = canonical(key);
    for (let hops = 0; hops < 5; hops++) {
      const next = alias.get(k);
      if (!next || next === k) break;
      k = next;
    }
    return k;
  };

  // 1. Variant spellings (buon -> buono, ed -> e, po' -> poco) join their base lemma.
  const rootsByLemma = new Map<string, string[]>();
  for (const [key] of candidates) {
    const { lemma } = parseUnitKey(key);
    let list = rootsByLemma.get(lemma);
    if (!list) rootsByLemma.set(lemma, (list = []));
    list.push(key);
  }
  const variants: string[] = [];
  const baseOf = new Map<string, string>();
  for (const [key] of candidates) {
    const { lemma, upos } = parseUnitKey(key);
    if (GLOSS_OVERRIDES[key]) continue;
    const base = variantOf(entriesOf(lemma), WIKTIONARY_POS[upos]);
    if (base && base !== lemma) baseOf.set(key, base);
  }
  // Morph-it! sometimes uses a shortened variant as the lemma (alcun for alcuni):
  // such a lemma is shown, and glossed, under its full form.
  const shownLemma = new Map<string, string>();
  const missingBases = new Set([...baseOf.values()].filter((b) => !rootsByLemma.has(b)));
  for (const [word, entries] of await readWiktionary(missingBases)) wiktionary.set(word, entries);
  for (const [key, base] of baseOf) {
    const roots = rootsByLemma.get(base) ?? [];
    const target = roots.find((r) => parseUnitKey(r).upos === parseUnitKey(key).upos) ?? roots[0];
    if (target) {
      alias.set(key, target);
      variants.push(`${key} -> ${target}`);
    } else {
      // Only a shortened form (alcun of alcuno) with the same part of speech.
      const { lemma, upos } = parseUnitKey(key);
      const wanted = new Set(WIKTIONARY_POS[upos].map(posClass));
      const sameClass = entriesOf(base).some((e) => wanted.has(posClass(e.pos)));
      if (!base.startsWith(lemma) || !sameClass) continue;
      shownLemma.set(lemma, base);
      variants.push(`${key} -> ${base} (shown as)`);
    }
  }
  const glossEntries = (lemma: string) => entriesOf(shownLemma.get(lemma) ?? lemma);

  // 2. Each remaining group takes the part of speech that has a gloss.
  interface Glossed {
    key: string;
    gloss: string;
    offensive: boolean;
  }
  const glossed = new Map<string, Glossed>();
  for (const [root] of candidates) {
    if (alias.has(root)) continue;
    const group = members.get(root) ?? [root];
    let found: Glossed | null = null;
    for (const key of group) {
      const override = GLOSS_OVERRIDES[key];
      if (override) {
        found = { key, gloss: override, offensive: false };
        break;
      }
    }
    for (const key of found ? [] : group) {
      const { lemma, upos } = parseUnitKey(key);
      const picked = pickGloss(glossEntries(lemma), upos);
      if (picked) {
        found = { key, ...picked };
        break;
      }
    }
    if (!found) {
      const { lemma, upos } = parseUnitKey(root);
      const picked = pickGloss(glossEntries(lemma), upos, { anyPos: true });
      if (picked) found = { key: root, ...picked };
    }
    if (!found) {
      dropped.noGloss++;
      continue;
    }
    if (found.key !== root) alias.set(root, found.key);
    glossed.set(found.key, found);
  }

  // 3. Rank by the summed count of everything folded into each lemma.
  const total = new Map<string, number>();
  for (const [key, n] of candidates) {
    const k = resolve(key);
    if (glossed.has(k)) total.set(k, (total.get(k) ?? 0) + n);
  }
  const ranked = [...total.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const genderOf = new Map<string, 'm' | 'f'>();
  for (const readings of lexicon.values()) {
    for (const r of readings) {
      const u = r.units[0];
      if (u?.upos === 'NOUN' && r.gender && r.units.length === 1)
        genderOf.set(unitKey(u), r.gender);
    }
  }
  const lemmaRows: SeedLemma[] = [];
  const glossedKeys: string[] = [];
  const firstGloss = new Map<string, string>();
  for (const [key, count] of ranked) {
    const { lemma, upos } = parseUnitKey(key);
    const picked = glossed.get(key);
    if (!picked) continue;
    if (picked.offensive) {
      dropped.offensive++;
      continue;
    }
    // Same spelling and same meaning as a lemma already kept (domani adverb and
    // noun, both "tomorrow"): fold it into that lemma.
    const firstItem = picked.gloss.split(/[,;]/)[0]?.trim().toLowerCase() ?? '';
    const twin = firstGloss.get(`${lemma}|${firstItem}`);
    if (twin) {
      alias.set(key, twin);
      continue;
    }
    firstGloss.set(`${lemma}|${firstItem}`, key);
    glossedKeys.push(key);
    if (lemmaRows.length < LEMMA_COUNT) {
      const gender = upos === 'NOUN' ? genderOf.get(key) : undefined;
      const shown = shownLemma.get(lemma) ?? lemma;
      lemmaRows.push({
        id: lemmaId(shown, upos),
        lemma: shown,
        pos: upos,
        freqRank: lemmaRows.length + 1,
        glossEn: picked.gloss,
        audioRef: null,
        extra: {
          ...(gender ? { gender } : {}),
          perMillion: Math.round((count / counted.totalTokens) * 1e6 * 100) / 100,
        },
      });
    }
  }
  const ids = new Set(lemmaRows.map((l) => l.id));
  if (ids.size !== lemmaRows.length) throw new Error('Lemma id collision; change the hash input');
  const lemmaFrequency = (key: string) => total.get(resolve(key)) ?? 0;

  // Coverage is measured on the frequency list's own (merged) keys.
  const coverage = Object.fromEntries(
    COVERAGE_LEVELS.map((n) => {
      const top = new Set(glossedKeys.slice(0, n));
      const known = new Set([...counted.counts.keys()].filter((k) => top.has(resolve(k))));
      return [`top${n}`, round(tokenCoverage(counted, known))];
    }),
  );
  log(`coverage ${JSON.stringify(coverage)}`);

  log('tatoeba');
  const idByKey = new Map(lemmaRows.map((l, i) => [glossedKeys[i] ?? '', l.id]));
  const rankById = new Map(lemmaRows.map((l) => [l.id, l.freqRank]));
  const links = new Map<number, number[]>();
  for await (const line of bz2Lines(cachePath('tatoeba-ita-eng-links'))) {
    const [a, b] = line.split('\t').map(Number);
    if (!a || !b) continue;
    let list = links.get(a);
    if (!list) links.set(a, (list = []));
    list.push(b);
  }
  const ita = await readTatoeba(cachePath('tatoeba-ita'), new Set(links.keys()));
  const eng = await readTatoeba(cachePath('tatoeba-eng'), new Set([...links.values()].flat()));
  const natives = await readNativeSpeakers();

  const readingIds = (r: Reading): number[] | null => {
    const out: number[] = [];
    for (const u of r.units) {
      const id = idByKey.get(resolve(unitKey(u)));
      if (id === undefined) return null;
      out.push(id);
    }
    return out;
  };

  interface Built {
    it: TatoebaSentence;
    en: TatoebaSentence;
    tokens: [number, number, ...number[]][];
    lemmaIds: number[];
    grammarIds: number[];
  }
  const built = new Map<number, Built>();
  const cands: Candidate[] = [];
  const corpus = { tokens: 0, known: 0, sentences: 0 };
  const rejected = {
    length: 0,
    digits: 0,
    unknownWord: 0,
    names: 0,
    outOfScope: 0,
    duplicate: 0,
    english: 0,
  };
  const seenNorm = new Set<string>();
  const sortedIta = [...ita.values()].sort((a, b) => a.id - b.id);
  for (const s of sortedIta) {
    const tagged = tagSentence(s.text, lexicon, subtlex, {
      allowed: (r) => readingIds(r) !== null,
      lemmaFrequency,
    });
    corpus.sentences++;
    corpus.tokens += tagged.length;
    corpus.known += tagged.filter((t) => t.reading).length;
    if (tagged.length < MIN_TOKENS || tagged.length > MAX_TOKENS) {
      rejected.length++;
      continue;
    }
    if (tagged.some((t) => t.numeric)) {
      rejected.digits++;
      continue;
    }
    if (tagged.some((t) => !t.reading && !t.properNoun)) {
      rejected.unknownWord++;
      continue;
    }
    const names = tagged.filter((t) => t.properNoun).length;
    if (names > MAX_PROPER_NOUNS || names === tagged.length) {
      rejected.names++;
      continue;
    }
    if (usesOutOfScopeGrammar(tagged)) {
      rejected.outOfScope++;
      continue;
    }
    const norm = tagged.map((t) => t.lower).join(' ');
    if (seenNorm.has(norm)) {
      rejected.duplicate++;
      continue;
    }
    const translations = (links.get(s.id) ?? [])
      .map((id) => eng.get(id))
      .filter((e): e is TatoebaSentence => !!e && e.text.length > 0 && e.text.length <= 160)
      .sort(
        (a, b) =>
          Number(natives.eng.has(b.author ?? '')) - Number(natives.eng.has(a.author ?? '')) ||
          a.id - b.id,
      );
    const en = translations[0];
    if (!en) {
      rejected.english++;
      continue;
    }
    seenNorm.add(norm);

    const tokens: [number, number, ...number[]][] = [];
    const lemmaIds: number[] = [];
    const formOf = new Map<number, string>();
    for (const t of tagged) {
      const lids = t.reading ? (readingIds(t.reading) ?? []) : [];
      for (const l of lids) {
        if (!lemmaIds.includes(l)) lemmaIds.push(l);
        if (!formOf.has(l)) formOf.set(l, t.lower);
      }
      tokens.push([t.start, t.end, ...lids.map((l) => lemmaIds.indexOf(l))]);
    }
    let difficulty = 0;
    let rarest = 0;
    for (const l of lemmaIds) {
      const rank = rankById.get(l) ?? 0;
      if (rank > difficulty) {
        difficulty = rank;
        rarest = l;
      }
    }
    const words = tagged.length;
    const score =
      (natives.ita.has(s.author ?? '') ? 2 : 0) +
      (natives.eng.has(en.author ?? '') ? 0.5 : 0) -
      Math.abs(words - 7) * 0.3 -
      names * 1.5 -
      (en.text.length > s.text.length * 2 || en.text.length * 2 < s.text.length ? 1 : 0);
    built.set(s.id, { it: s, en, tokens, lemmaIds, grammarIds: detectGrammar(s.text, tagged) });
    cands.push({ id: s.id, norm, lemmaIds, difficulty, rarestLemmaId: rarest, formOf, score });
  }
  log(`candidates ${cands.length} ${JSON.stringify(rejected)}`);

  const selection = selectSentences(
    cands,
    lemmaRows.map((l) => l.id),
    { perLemma: 5, fallbackPerLemma: 2, perForm: 2 },
  );
  const sentenceRows: SeedSentence[] = [...selection.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, sel]) => {
      const b = built.get(id);
      if (!b) throw new Error(`missing sentence ${id}`);
      return {
        id,
        it: b.it.text,
        en: b.en.text,
        lemmaIds: b.lemmaIds,
        grammarIds: b.grammarIds,
        source: `tatoeba:${id}`,
        licence: 'CC-BY-2.0-FR',
        extra: {
          targetLemmaId: sel.targetLemmaId,
          difficulty: Math.max(...b.lemmaIds.map((l) => rankById.get(l) ?? 1)),
          anchor: sel.anchor,
          tokens: b.tokens,
          enSentenceId: b.en.id,
          itAuthor: b.it.author,
          enAuthor: b.en.author,
        },
      };
    });

  const grammarRows: SeedGrammarPoint[] = grammarSeedRows();

  const sources: SeedSource[] = SOURCES.map((s) => {
    const entry = lock[s.id];
    if (!entry) throw new Error(`${s.id} missing from lock`);
    return {
      id: s.id,
      name: s.name,
      url: s.url,
      homepage: sourceById(s.id).homepage,
      licence: s.licence,
      sha256: entry.sha256,
      bytes: entry.bytes,
      fetchedAt: entry.fetchedAt,
      usedFor: USED_FOR[s.id],
    };
  });

  const content = {
    version: SEED_VERSION,
    sources,
    lemmas: lemmaRows,
    sentences: sentenceRows,
    grammarPoints: grammarRows,
  } as const;
  const previous = existsSync(SEED_PATH)
    ? (JSON.parse(await readFile(SEED_PATH, 'utf8')) as Partial<Seed>)
    : null;
  const unchanged =
    previous &&
    serialise({ ...content, generatedAt: '' }) ===
      serialise({ ...(previous as Seed), generatedAt: '' });
  const generatedAt =
    unchanged && previous.generatedAt ? previous.generatedAt : new Date().toISOString();
  const seed: Seed = SeedSchema.parse({ ...content, generatedAt });

  // Report
  const top2000 = new Set(lemmaRows.filter((l) => l.freqRank <= 2000).map((l) => l.id));
  const withSentence = new Set(sentenceRows.flatMap((s) => s.lemmaIds));
  const asTarget = new Set(sentenceRows.map((s) => s.extra.targetLemmaId));
  const report = {
    generatedAt,
    counts: {
      lemmas: lemmaRows.length,
      sentences: sentenceRows.length,
      anchorSentences: sentenceRows.filter((s) => s.extra.anchor).length,
      grammarPoints: grammarRows.length,
      sentencesWithGrammarTags: sentenceRows.filter((s) => s.grammarIds.length > 0).length,
    },
    lemmaPipeline: {
      frequencyListTokens: counted.totalTokens,
      unknownTokenShare: round(counted.unknownTokens / counted.totalTokens),
      properNounTokenShare: round(counted.properNounTokens / counted.totalTokens),
      droppedWithoutGloss: dropped.noGloss,
      droppedOffensive: dropped.offensive,
      droppedAsHomographShadows: dropped.shadowed,
      variantSpellings: variants,
    },
    coverage: {
      description:
        'Share of all tokens in the FrequencyWords subtitle list (including names, foreign words and typos) whose lemmas are in the top N glossed lemmas',
      ...coverage,
      tatoebaTokensKnownByTop3000: round(corpus.known / corpus.tokens),
    },
    sentenceCoverage: {
      top2000WithAnySentence: round(count(top2000, (id) => withSentence.has(id)) / top2000.size),
      top2000AsTarget: round(count(top2000, (id) => asTarget.has(id)) / top2000.size),
      allWithAnySentence: round(
        lemmaRows.filter((l) => withSentence.has(l.id)).length / lemmaRows.length,
      ),
      top2000WithoutSentence: lemmaRows
        .filter((l) => l.freqRank <= 2000 && !withSentence.has(l.id))
        .map((l) => `${l.lemma} (${l.pos})`),
    },
    tatoeba: { italianWithEnglish: ita.size, candidates: cands.length, rejected },
    grammarTagCounts: Object.fromEntries(
      grammarRows.map((g) => [
        g.extra.slug,
        sentenceRows.filter((s) => s.grammarIds.includes(g.id)).length,
      ]),
    ),
  };

  // The most frequent word forms and the seed lemmas their likeliest reading maps
  // to, so a test can check that no frequent word is missing from the seed.
  const seedKeys = new Set(idByKey.keys());
  const topForms = formCounts.slice(0, TOP_FORMS).map(({ form }, i) => {
    const rank = i + 1;
    const readings = (lookup(lexicon, form) ?? []).filter((r) => r.units[0]?.upos !== 'PROPN');
    const excluded = EXCLUDED_TOP_FORMS[form];
    if (excluded) return { rank, form, status: 'excluded', reason: excluded };
    if (properNounShare(subtlex.get(form)) > 0.5) return { rank, form, status: 'name' };
    if (readings.length === 0) return { rank, form, status: 'unknown' };
    const priors = readingPriors(readings, subtlex.get(form), lemmaFrequency);
    let best = 0;
    priors.forEach((w, j) => {
      if (w > (priors[best] ?? 0)) best = j;
    });
    const keys = (readings[best]?.units ?? []).map((u) => resolve(unitKey(u)));
    const status = keys.every((k) => seedKeys.has(k)) ? 'ok' : 'missing';
    // As the seed shows them (lemma|pos).
    const lemmas = keys.map((k) => {
      const { lemma, upos } = parseUnitKey(k);
      return `${shownLemma.get(lemma) ?? lemma}|${upos}`;
    });
    return { rank, form, status, lemmas };
  });
  const missingTop = topForms.filter((f) => f.status !== 'ok').map((f) => `${f.form}:${f.status}`);
  log(`top ${TOP_FORMS} forms not mapped: ${missingTop.join(' ')}`);

  await mkdir(SEED_DIR, { recursive: true });
  await writeFile(
    TOP_FORMS_PATH,
    `[\n${topForms.map((f) => `  ${JSON.stringify(f)}`).join(',\n')}\n]\n`,
  );
  await writeFile(SEED_PATH, serialise(seed));
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  log(`wrote ${SEED_PATH} (${seed.lemmas.length} lemmas, ${seed.sentences.length} sentences)`);
  log(JSON.stringify(report.counts));
  log(JSON.stringify(report.sentenceCoverage).slice(0, 400));
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function count<T>(set: ReadonlySet<T>, pred: (x: T) => boolean): number {
  let n = 0;
  for (const x of set) if (pred(x)) n++;
  return n;
}

const serialise = serialiseSeed;

await main();
