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
import { SOURCES, type SourceId } from './sources';
import { GRAMMAR_POINTS } from '../src/grammar/points';
import { detectGrammar, usesOutOfScopeGrammar } from '../src/grammar/rules';
import {
  countLemmas,
  mergeHomographs,
  parseFrequencyWords,
  parseSubtlex,
  shadowedLemmas,
  tokenCoverage,
} from '../src/pipeline/frequency';
import { pickGloss, type WiktionaryEntry } from '../src/pipeline/glosses';
import { lemmaId } from '../src/pipeline/ids';
import {
  applyFormReadings,
  parseUnitKey,
  parseMorphIt,
  type Reading,
  unitKey,
} from '../src/pipeline/lexicon';
import {
  BLOCKED_LEMMAS,
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

function run(command: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${command} ${args.join(' ')} exited with ${String(code)}`));
    });
  });
}

/** Stream the lines of a .bz2 file (needs the `bzip2` command). */
async function* bz2Lines(path: string): AsyncGenerator<string> {
  const child = spawn('bzip2', ['-dc', path]);
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

async function readMorphIt(): Promise<string> {
  const archive = cachePath('morph-it');
  const listing = (await run('tar', ['-tzf', archive])).toString('utf8').split('\n');
  const member = listing.find((m) => /morph-it_\d+\.txt$/.test(m));
  if (!member) throw new Error('morph-it.tgz has no morph-it_*.txt');
  return (await run('tar', ['-xzOf', archive, member])).toString('latin1');
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
  const firstPass = countLemmas(formCounts, lexicon, subtlex);
  const canonical = mergeHomographs(firstPass.counts, { preferred: PREFERRED_POS });
  const counted = countLemmas(formCounts, lexicon, subtlex, { canonical });
  const lemmaFrequency = (key: string) => counted.counts.get(canonical(key)) ?? 0;
  const shadowed = shadowedLemmas(counted, new Set(['VERB', 'ADJ']));
  const ranked = [...counted.counts.entries()]
    .filter(([key]) => eligibleKey(key) && !shadowed.has(key))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const candidates = ranked.slice(0, 9000);

  log('glosses');
  const wiktionary = await readWiktionary(new Set(candidates.map(([k]) => k.split('|')[0] ?? '')));
  const lemmaRows: SeedLemma[] = [];
  const glossedKeys: string[] = [];
  const dropped = { noGloss: 0, offensive: 0, shadowed: shadowed.size };
  const alias = new Map<string, string>();
  const firstGloss = new Map<string, string>();
  const genderOf = new Map<string, 'm' | 'f'>();
  for (const readings of lexicon.values()) {
    for (const r of readings) {
      const u = r.units[0];
      if (u?.upos === 'NOUN' && r.gender && r.units.length === 1)
        genderOf.set(unitKey(u), r.gender);
    }
  }
  for (const [key, count] of candidates) {
    const { lemma, upos } = parseUnitKey(key);
    const override = GLOSS_OVERRIDES[key];
    const picked = override
      ? { gloss: override, offensive: false }
      : pickGloss(wiktionary.get(lemma) ?? [], upos);
    if (!picked) {
      dropped.noGloss++;
      continue;
    }
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
      lemmaRows.push({
        id: lemmaId(lemma, upos),
        lemma,
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

  const coverage = Object.fromEntries(
    COVERAGE_LEVELS.map((n) => [
      `top${n}`,
      round(tokenCoverage(counted, new Set(glossedKeys.slice(0, n)))),
    ]),
  );
  log(`coverage ${JSON.stringify(coverage)}`);

  log('tatoeba');
  const idByKey = new Map(lemmaRows.map((l) => [`${l.lemma}|${l.pos}`, l.id]));
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
      const key = canonical(unitKey(u));
      const id = idByKey.get(alias.get(key) ?? key);
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

  const grammarRows: SeedGrammarPoint[] = GRAMMAR_POINTS.map((p, i) => ({
    id: p.id,
    title: p.title,
    order: i + 1,
    prerequisiteIds: p.prerequisites.map((slug) => {
      const pre = GRAMMAR_POINTS.find((q) => q.slug === slug);
      if (!pre) throw new Error(`${p.slug}: unknown prerequisite ${slug}`);
      return pre.id;
    }),
    noteMd: p.noteMd,
    extra: { slug: p.slug, cefr: p.cefr },
  }));

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
      mergedSameMeaning: [...alias.keys()],
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

  await mkdir(SEED_DIR, { recursive: true });
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

/** One row per line: compact, but diffs stay readable. */
function serialise(seed: Omit<Seed, 'generatedAt'> & { generatedAt: string }): string {
  const rows = (items: readonly unknown[]) =>
    items.length === 0
      ? '[]'
      : `[\n${items.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
  return [
    '{',
    `  "version": ${JSON.stringify(seed.version)},`,
    `  "generatedAt": ${JSON.stringify(seed.generatedAt)},`,
    `  "sources": ${rows(seed.sources)},`,
    `  "lemmas": ${rows(seed.lemmas)},`,
    `  "sentences": ${rows(seed.sentences)},`,
    `  "grammarPoints": ${rows(seed.grammarPoints)}`,
    '}',
    '',
  ].join('\n');
}

await main();
