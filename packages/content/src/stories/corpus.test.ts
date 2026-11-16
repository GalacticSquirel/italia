/**
 * Validates the committed story corpus (`stories/`), its index and the bundle
 * in `seed/stories.v1.json`. Rebuild with `pnpm --filter @italia/content build:stories`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { BAND_RULES, STORY_BANDS } from './bands';
import { parseStoriesFile } from './loader';
import {
  type Story,
  StoryIndexSchema,
  StorySchema,
  StorySeriesSchema,
  type StoriesFile,
} from './schema';
import { serialiseStoriesFile, serialiseStory } from './serialise';
import { parseStorySource } from './source';
import { createStoryTagger, normaliseApostrophes, type StoryLemma } from './tagger';
import { validateCorpus, validateStory } from './validate';
import { cachePath } from '../../scripts/cache';
import { readMorphIt } from '../../scripts/morph-it';
import {
  loadSeedFile,
  loadStoriesFile,
  loadVariantSpellings,
  MANIFEST_FILE,
  SEED_FILE,
  STORIES_DIR,
  STORIES_FILE,
} from '../node';
import { parseSubtlex } from '../pipeline/frequency';
import { applyFormReadings, parseMorphIt } from '../pipeline/lexicon';
import { FORM_READINGS, LEXICON_SUPPLEMENT } from '../pipeline/overrides';
import { type Seed, SeedManifestSchema } from '../schema';

const read = (path: string) => readFileSync(path, 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

let seed: Seed;
let lemmas: Map<number, StoryLemma>;
let bundle: StoriesFile;
const seriesDirs = readdirSync(STORIES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const files = seriesDirs.flatMap((dir) =>
  readdirSync(join(STORIES_DIR, dir))
    .filter((f) => /^\d{2}\.json$/.test(f))
    .sort()
    .map((f) => ({
      dir,
      json: join(STORIES_DIR, dir, f),
      txt: join(STORIES_DIR, dir, f.replace('.json', '.txt')),
    })),
);
const stories: Story[] = files.map((f) => StorySchema.parse(JSON.parse(read(f.json))));

beforeAll(async () => {
  seed = await loadSeedFile();
  lemmas = new Map(seed.lemmas.map((l) => [l.id, l]));
  bundle = await loadStoriesFile();
});

describe('committed stories', () => {
  it('has at least 8 series of 5 episodes covering every band', () => {
    expect(seriesDirs.length).toBeGreaterThanOrEqual(8);
    expect(stories.length).toBeGreaterThanOrEqual(40);
    for (const band of STORY_BANDS) {
      expect(stories.filter((s) => s.band === band).length, `band ${band}`).toBeGreaterThanOrEqual(
        5,
      );
    }
    const low = new Set(stories.filter((s) => s.band <= 500).map((s) => s.seriesId));
    expect(low.size).toBeGreaterThanOrEqual(3);
  });

  it('passes validation against the seed', () => {
    const rows = stories.map((s) => validateStory(s, lemmas));
    for (const r of rows) expect(r.errors, r.id).toEqual([]);
    const series = seriesDirs.map((d) =>
      StorySeriesSchema.parse(JSON.parse(read(join(STORIES_DIR, d, 'series.json')))),
    );
    expect(validateCorpus(series, stories)).toEqual([]);
    const summary = STORY_BANDS.map((band) => {
      const inBand = rows.filter((r) => r.band === band);
      const words = inBand.reduce((n, r) => n + r.wordCount, 0);
      const coverage = Math.min(...inBand.map((r) => r.inBand));
      return `${band}: ${inBand.length} stories, ${words} words, min in-band ${(coverage * 100).toFixed(1)}%`;
    });
    console.info(summary.join('\n'));
  });

  it('matches its source text and the deterministic file layout', () => {
    files.forEach((f, i) => {
      const story = stories[i];
      if (!story) throw new Error(f.json);
      expect(read(f.json)).toBe(serialiseStory(story));
      const source = parseStorySource(read(f.txt));
      expect(story.title).toEqual({
        it: normaliseApostrophes(source.title.it),
        en: source.title.en,
      });
      expect(story.paragraphs.map((p) => p.sentences.map((s) => ({ it: s.it, en: s.en })))).toEqual(
        source.paragraphs.map((p) => p.map((s) => ({ it: normaliseApostrophes(s.it), en: s.en }))),
      );
      const text = (x: { it: string; en: string }) => ({ it: normaliseApostrophes(x.it), en: x.en });
      expect(
        story.questions.map((q) => ({
          prompt: { it: q.prompt.it, en: q.prompt.en },
          options: q.options.map((o) => ({ it: o.it, en: o.en })),
          answer: q.answer,
        })),
      ).toEqual(
        source.questions.map((q) => ({
          prompt: text(q.prompt),
          options: q.options.map(text),
          answer: q.answer,
        })),
      );
      expect(story.seriesId).toBe(f.dir);
    });
  });

  it('is listed in stories/index.json', () => {
    const index = StoryIndexSchema.parse(JSON.parse(read(join(STORIES_DIR, 'index.json'))));
    expect(index.stories.map((e) => e.id).sort()).toEqual(stories.map((s) => s.id).sort());
    for (const entry of index.stories) {
      const story = stories.find((s) => s.id === entry.id);
      expect(story?.wordCount).toBe(entry.wordCount);
      expect(story?.band).toBe(entry.band);
      expect(existsSync(join(STORIES_DIR, entry.file))).toBe(true);
    }
    expect(index.series.map((s) => s.id).sort()).toEqual(seriesDirs);
  });
});

describe('seed/stories.v1.json', () => {
  it('bundles exactly the committed stories, tagged against the committed seed', () => {
    expect(parseStoriesFile(bundle)).toEqual(bundle);
    expect([...bundle.stories].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...stories].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(read(STORIES_FILE)).toBe(serialiseStoriesFile(bundle));
    expect(bundle.seedSha256).toBe(sha256(read(SEED_FILE)));
    // Bands ascend through the bundle, so the app can page through it in order.
    const order = bundle.stories.map((s) => STORY_BANDS.indexOf(s.band));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('is listed in seed/manifest.json with its checksum', () => {
    const manifest = SeedManifestSchema.parse(JSON.parse(read(MANIFEST_FILE)));
    for (const [path, file] of [
      ['seed.v1.json', SEED_FILE],
      ['stories.v1.json', STORIES_FILE],
    ] as const) {
      const entry = manifest.files.find((f) => f.path === path);
      const text = read(file);
      expect(entry?.sha256, path).toBe(sha256(text));
      expect(entry?.bytes, path).toBe(Buffer.byteLength(text));
    }
  });

  it('keeps every story within its band word range', () => {
    for (const s of bundle.stories) {
      const [min, max] = BAND_RULES[s.band].words;
      expect(s.wordCount).toBeGreaterThanOrEqual(min);
      expect(s.wordCount).toBeLessThanOrEqual(max);
    }
  });
});

// Re-tagging needs the Morph-it! and SUBTLEX-IT files from `fetch:sources`; CI
// without the cache skips it.
const haveCache = existsSync(cachePath('morph-it')) && existsSync(cachePath('subtlex-it'));

describe.skipIf(!haveCache)('re-tagging the sources', () => {
  it('reproduces the committed story files', { timeout: 120_000 }, async () => {
    const lexicon = parseMorphIt(`${await readMorphIt()}\n${LEXICON_SUPPLEMENT}`);
    applyFormReadings(lexicon, FORM_READINGS);
    const subtlex = parseSubtlex(readFileSync(cachePath('subtlex-it'), 'latin1'));
    const tagger = createStoryTagger({
      lexicon,
      subtlex,
      lemmas: seed.lemmas,
      variants: await loadVariantSpellings(),
    });
    for (const dir of seriesDirs) {
      const meta = StorySeriesSchema.parse(JSON.parse(read(join(STORIES_DIR, dir, 'series.json'))));
      const taught = new Set<number>();
      for (const f of files.filter((x) => x.dir === dir)) {
        const index = Number(f.json.slice(-7, -5));
        const { story, issues } = tagger.tagStory(
          parseStorySource(read(f.txt)),
          { seriesId: dir, seriesIndex: index, band: meta.band },
          { taught },
        );
        for (const id of story.targetLemmaIds) taught.add(id);
        expect(issues, story.id).toEqual([]);
        expect(serialiseStory(story)).toBe(read(f.json));
      }
    }
  });
});
