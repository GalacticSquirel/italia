/**
 * Validates the committed seed (`seed/seed.v1.json`), prints its coverage
 * statistics and checks that the most frequent words are in it. Rebuild the
 * seed with `pnpm --filter @italia/content build:seed`.
 */
import { readFileSync, statSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { GRAMMAR_POINTS } from './grammar/points';
import { toRows } from './loader';
import { loadSeedFile, SEED_FILE } from './node';
import { lemmaId } from './pipeline/ids';
import { EXCLUDED_TOP_FORMS } from './pipeline/overrides';
import { type Seed } from './schema';

let seed: Seed;

beforeAll(async () => {
  seed = await loadSeedFile();
});

describe('seed.v1.json', () => {
  it('passes the zod schema and stays under 24 MB', () => {
    expect(seed.version).toBe(1);
    expect(statSync(SEED_FILE).size).toBeLessThan(24 * 1024 * 1024);
  });

  it('has about 10,000 unique lemmas with dense ranks and hash ids', () => {
    expect(seed.lemmas.length).toBeGreaterThanOrEqual(9900);
    const ranks = seed.lemmas.map((l) => l.freqRank).sort((a, b) => a - b);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    expect(new Set(seed.lemmas.map((l) => `${l.lemma}|${l.pos}`)).size).toBe(seed.lemmas.length);
    for (const l of seed.lemmas) expect(l.id).toBe(lemmaId(l.lemma, l.pos));
  });

  it('has no dangling ids', () => {
    const lemmaIds = new Set(seed.lemmas.map((l) => l.id));
    const grammarIds = new Set(seed.grammarPoints.map((g) => g.id));
    const sentenceIds = new Set<number>();
    for (const s of seed.sentences) {
      expect(sentenceIds.has(s.id)).toBe(false);
      sentenceIds.add(s.id);
      for (const id of s.lemmaIds) expect(lemmaIds.has(id)).toBe(true);
      for (const id of s.grammarIds) expect(grammarIds.has(id)).toBe(true);
      expect(lemmaIds.has(s.extra.targetLemmaId)).toBe(true);
    }
    for (const g of seed.grammarPoints) {
      for (const id of g.prerequisiteIds) expect(grammarIds.has(id)).toBe(true);
    }
  });

  it('has an acyclic grammar prerequisite graph matching the source data', () => {
    const byId = new Map(seed.grammarPoints.map((g) => [g.id, g]));
    const state = new Map<number, 'visiting' | 'done'>();
    const visit = (id: number): void => {
      if (state.get(id) === 'done') return;
      expect(state.get(id), `cycle through ${id}`).not.toBe('visiting');
      state.set(id, 'visiting');
      for (const pre of byId.get(id)?.prerequisiteIds ?? []) visit(pre);
      state.set(id, 'done');
    };
    for (const g of seed.grammarPoints) visit(g.id);
    expect(seed.grammarPoints.map((g) => g.id)).toEqual(GRAMMAR_POINTS.map((p) => p.id));
    for (const g of seed.grammarPoints) {
      for (const pre of g.prerequisiteIds) expect(byId.get(pre)?.order).toBeLessThan(g.order);
    }
  });

  it('gives almost every top-2,000 lemma at least one sentence', () => {
    const withSentence = new Set(seed.sentences.flatMap((s) => s.lemmaIds));
    const top = seed.lemmas.filter((l) => l.freqRank <= 2000);
    const covered = top.filter((l) => withSentence.has(l.id)).length / top.length;
    console.info(`top-2000 lemmas with a sentence: ${(covered * 100).toFixed(1)}%`);
    expect(covered).toBeGreaterThanOrEqual(0.98);
  });

  it('only uses sentences of 3 to 12 words with sensible difficulty', () => {
    const rank = new Map(seed.lemmas.map((l) => [l.id, l.freqRank]));
    for (const s of seed.sentences) {
      expect(s.extra.tokens.length).toBeGreaterThanOrEqual(3);
      expect(s.extra.tokens.length).toBeLessThanOrEqual(12);
      expect(s.extra.difficulty).toBe(Math.max(...s.lemmaIds.map((id) => rank.get(id) ?? 0)));
      if (s.extra.anchor) expect(rank.get(s.extra.targetLemmaId)).toBe(s.extra.difficulty);
    }
  });

  it('records every source with a licence and checksum', () => {
    const lock = JSON.parse(
      readFileSync(new URL('../sources.lock.json', import.meta.url), 'utf8'),
    ) as Record<string, { sha256: string }>;
    for (const source of seed.sources) expect(lock[source.id]?.sha256).toBe(source.sha256);
    for (const s of seed.sentences) expect(s.source).toBe(`tatoeba:${s.id}`);
  });

  it('reports corpus coverage', () => {
    const report = JSON.parse(
      readFileSync(new URL('../seed/build-report.json', import.meta.url), 'utf8'),
    ) as { coverage: Record<string, number | string> };
    console.info('token coverage', report.coverage);
    expect(report.coverage.top2000).toBeGreaterThan(0.75);
    expect(Number(report.coverage.top5000)).toBeGreaterThan(Number(report.coverage.top2000));
  });

  it('converts to table rows without extra fields', () => {
    const rows = toRows(seed);
    expect(Object.keys(rows.lemmas[0] ?? {})).toEqual([
      'id',
      'lemma',
      'pos',
      'freqRank',
      'glossEn',
      'audioRef',
    ]);
    expect(rows.sentences[0]).not.toHaveProperty('extra');
    expect(rows.grammarPoints[0]).not.toHaveProperty('extra');
  });
});

/**
 * Words every beginner meets in the first weeks, with the rank they must fall
 * within (a seed lemma with that spelling, any part of speech).
 */
const MUST_HAVE: Readonly<Record<number, string>> = {
  100: `il un di a da in con su per e o ma se che non come quando dove perché anche più molto tutto
    altro questo quello mio tuo suo io tu lei ci si ne chi cosa sì no mai ora qui bene così essere
    avere fare dire andare potere volere dovere sapere vedere venire stare dare parlare pensare
    sentire grazie`,
  250: `tra poco ogni nessuno qualche stesso nostro vostro loro lui noi voi cui ecco già ancora sempre
    adesso poi troppo niente dopo capire grande buono bello nuovo uomo donna tempo giorno casa vita
    anno padre madre amico lavoro due ciao`,
  500: 'alcuno lì male però nulla prima vecchio piccolo gente mondo tre scusa',
  1000: 'sotto sopra mille buongiorno',
};

interface TopForm {
  rank: number;
  form: string;
  status: 'ok' | 'missing' | 'name' | 'unknown' | 'excluded';
  lemmas?: string[];
  reason?: string;
}

describe('frequent words', () => {
  const readJson = (file: string): unknown =>
    JSON.parse(readFileSync(new URL(`../seed/${file}`, import.meta.url), 'utf8'));

  it('includes the must-have words with sensible ranks', () => {
    const rankOf = new Map<string, number>();
    for (const l of seed.lemmas)
      rankOf.set(l.lemma, Math.min(rankOf.get(l.lemma) ?? Infinity, l.freqRank));
    const words = Object.entries(MUST_HAVE).flatMap(([limit, list]) =>
      list
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({ word, limit: Number(limit) })),
    );
    expect(words.length).toBeGreaterThanOrEqual(100);
    const failures = words
      .filter(({ word, limit }) => !((rankOf.get(word) ?? Infinity) <= limit))
      .map(
        ({ word, limit }) =>
          `${word} (rank ${String(rankOf.get(word) ?? 'missing')}, limit ${limit})`,
      );
    expect(failures).toEqual([]);
  });

  it('maps every top-300 subtitle word form to a seed lemma, a name or a listed exclusion', () => {
    const forms = readJson('top-forms.json') as TopForm[];
    expect(forms).toHaveLength(300);
    const seedKeys = new Set(seed.lemmas.map((l) => `${l.lemma}|${l.pos}`));
    const failures: string[] = [];
    for (const f of forms) {
      if (f.status === 'name') continue;
      if (f.status === 'excluded') {
        if (!EXCLUDED_TOP_FORMS[f.form]) failures.push(`${f.form}: excluded without a reason`);
        continue;
      }
      const missing = (f.lemmas ?? []).filter((k) => !seedKeys.has(k));
      if (f.status !== 'ok' || !f.lemmas?.length || missing.length > 0)
        failures.push(`${f.form}: ${f.status} ${missing.join(' ')}`);
    }
    expect(failures).toEqual([]);
    // Spot checks: inflected and variant forms reach their base lemma.
    const lemmasOf = new Map(forms.map((f) => [f.form, f.lemmas]));
    expect(lemmasOf.get('mia')).toEqual(['mio|DET']);
    expect(lemmasOf.get('ed')).toEqual(['e|CCONJ']);
    expect(lemmasOf.get('ad')).toEqual(['a|ADP']);
    expect(lemmasOf.get('po')).toEqual(['poco|ADV']);
    expect(lemmasOf.get('vai')).toEqual(['andare|VERB']);
  });

  it('merges variant spellings into their base word', () => {
    const report = readJson('build-report.json') as {
      lemmaPipeline: { variantSpellings: string[] };
    };
    const variants = report.lemmaPipeline.variantSpellings;
    expect(variants).toContain('buon|ADJ -> buono|ADJ');
    expect(variants).toContain('bel|ADJ -> bello|ADJ');
    const lemmas = new Set(seed.lemmas.map((l) => l.lemma));
    for (const variant of ['buon', 'bel', 'ed', 'ad', "po'", 'alcun'])
      expect(lemmas.has(variant)).toBe(false);
  });
});
