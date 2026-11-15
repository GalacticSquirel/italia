/**
 * Tag and validate the graded stories, then write the bundle.
 *
 * Usage: `pnpm --filter @italia/content build:stories [--only <seriesId>]`
 *
 * Reads `stories/<series>/series.json` and `stories/<series>/<nn>.txt`, tags each
 * story against the committed seed with the Morph-it! lexicon (from `.cache/`,
 * fetched by `fetch:sources`), validates it against its band, and writes
 * `stories/<series>/<nn>.json`. A full run also writes `stories/index.json`,
 * `seed/stories.v1.json` and `seed/manifest.json`. Exits non-zero when any story
 * fails validation.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cachePath, readLock, sha256File } from './cache';
import { readMorphIt } from './morph-it';
import { loadSeedFile, MANIFEST_FILE, SEED_FILE, STORIES_DIR, STORIES_FILE } from '../src/node';
import { parseSubtlex } from '../src/pipeline/frequency';
import { applyFormReadings, parseMorphIt } from '../src/pipeline/lexicon';
import { FORM_READINGS, LEXICON_SUPPLEMENT } from '../src/pipeline/overrides';
import { type SeedManifest, SeedManifestSchema } from '../src/schema';
import { STORY_BANDS } from '../src/stories/bands';
import {
  type StoriesFile,
  StoriesFileSchema,
  type Story,
  StorySchema,
  type StoryIndex,
  StoryIndexSchema,
  type StorySeries,
  StorySeriesSchema,
  STORIES_VERSION,
} from '../src/stories/schema';
import { serialiseStoriesFile, serialiseStory } from '../src/stories/serialise';
import { parseStorySource } from '../src/stories/source';
import { createStoryTagger } from '../src/stories/tagger';
import { type StoryReport, validateCorpus, validateStory } from '../src/stories/validate';

const log = (message: string) => {
  console.log(`[build-stories] ${message}`);
};

async function verifiedCache(id: 'morph-it' | 'subtlex-it'): Promise<string> {
  const path = cachePath(id);
  if (!existsSync(path)) {
    throw new Error(`${path} is missing: run pnpm --filter @italia/content fetch:sources`);
  }
  const lock = await readLock();
  const sha = await sha256File(path);
  if (lock[id]?.sha256 !== sha) throw new Error(`${id}: cached file does not match the lock`);
  return path;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

async function main(): Promise<void> {
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt >= 0 ? process.argv[onlyAt + 1] : undefined;

  log('lexicon');
  await verifiedCache('morph-it');
  const lexicon = parseMorphIt(`${await readMorphIt()}\n${LEXICON_SUPPLEMENT}`);
  applyFormReadings(lexicon, FORM_READINGS);
  const subtlex = parseSubtlex(await readFile(await verifiedCache('subtlex-it'), 'latin1'));
  const seedText = await readFile(SEED_FILE, 'utf8');
  const seed = await loadSeedFile();
  const lemmaById = new Map(seed.lemmas.map((l) => [l.id, l]));
  const tagger = createStoryTagger({ lexicon, subtlex, lemmas: seed.lemmas });

  const series: StorySeries[] = [];
  const stories: Story[] = [];
  const reports: StoryReport[] = [];
  const dirs = (await readdir(STORIES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const dir of dirs) {
    const meta = StorySeriesSchema.parse(
      JSON.parse(await readFile(join(STORIES_DIR, dir, 'series.json'), 'utf8')),
    );
    if (meta.id !== dir) throw new Error(`stories/${dir}/series.json has id ${meta.id}`);
    series.push(meta);
    const taught = new Set<number>();
    const files = (await readdir(join(STORIES_DIR, dir)))
      .filter((f) => /^\d{2}\.txt$/.test(f))
      .sort();
    for (const file of files) {
      const path = join(STORIES_DIR, dir, file);
      const jsonPath = path.replace(/\.txt$/, '.json');
      if (only && only !== dir) {
        if (existsSync(jsonPath))
          stories.push(JSON.parse(await readFile(jsonPath, 'utf8')) as Story);
        continue;
      }
      const source = parseStorySource(await readFile(path, 'utf8'));
      const { story: tagged, issues } = tagger.tagStory(
        source,
        {
          seriesId: meta.id,
          seriesIndex: Number(file.slice(0, 2)),
          band: meta.band,
        },
        { taught },
      );
      const story = StorySchema.parse(tagged);
      for (const id of story.targetLemmaIds) taught.add(id);
      const report = validateStory(story, lemmaById);
      reports.push({ ...report, errors: [...issues, ...report.errors] });
      stories.push(story);
      await writeFile(jsonPath, serialiseStory(story));
    }
  }

  let failed = false;
  for (const r of reports) {
    const ok = r.errors.length === 0 ? 'ok  ' : 'FAIL';
    console.log(
      `${ok} ${r.id.padEnd(34)} band ${String(r.band).padStart(4)} ${String(r.wordCount).padStart(3)}w ` +
        `in ${(r.inBand * 100).toFixed(1)}% next ${(r.nextBand * 100).toFixed(1)}% ` +
        `names ${r.nameTokens} sent ${r.sentences} max ${r.longestSentence} mean ${r.meanSentence}` +
        (r.nextBandTokens.length > 0 ? ` | next: ${r.nextBandTokens.join(', ')}` : ''),
    );
    if (process.argv.includes('--verbose')) {
      const story = stories.find((s) => s.id === r.id);
      const targets = (story?.targetLemmaIds ?? []).map((id) => lemmaById.get(id)?.lemma ?? id);
      console.log(`       grammar: ${r.grammarUsed.join(' ')}`);
      console.log(`       targets: ${targets.join(' ')}`);
    }
    for (const e of r.errors) console.log(`       - ${e}`);
    if (r.errors.length > 0) failed = true;
  }
  const corpusErrors = validateCorpus(series, stories);
  for (const e of corpusErrors) console.log(`FAIL corpus: ${e}`);
  if (corpusErrors.length > 0) failed = true;

  if (!only) {
    const bandIndex = (s: { band: number }) => STORY_BANDS.findIndex((b) => b === s.band);
    series.sort((a, b) => bandIndex(a) - bandIndex(b) || a.id.localeCompare(b.id));
    const order = new Map(series.map((s, i) => [s.id, i]));
    stories.sort(
      (a, b) =>
        (order.get(a.seriesId) ?? 0) - (order.get(b.seriesId) ?? 0) ||
        a.seriesIndex - b.seriesIndex,
    );
    const index: StoryIndex = StoryIndexSchema.parse({
      version: STORIES_VERSION,
      series,
      stories: stories.map((s) => ({
        id: s.id,
        seriesId: s.seriesId,
        seriesIndex: s.seriesIndex,
        band: s.band,
        level: s.level,
        title: s.title,
        wordCount: s.wordCount,
        file: `${s.seriesId}/${String(s.seriesIndex).padStart(2, '0')}.json`,
      })),
    });
    await writeFile(join(STORIES_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

    const bundle: StoriesFile = StoriesFileSchema.parse({
      version: STORIES_VERSION,
      seedSha256: sha256(seedText),
      series,
      stories,
    });
    const bundleText = serialiseStoriesFile(bundle);
    await writeFile(STORIES_FILE, bundleText);
    const manifest: SeedManifest = SeedManifestSchema.parse({
      version: 1,
      files: [
        { path: 'seed.v1.json', sha256: sha256(seedText), bytes: Buffer.byteLength(seedText) },
        {
          path: `stories.v${STORIES_VERSION}.json`,
          sha256: sha256(bundleText),
          bytes: Buffer.byteLength(bundleText),
        },
      ],
    });
    await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
    const perBand = STORY_BANDS.map(
      (b) => `${b}:${stories.filter((s) => s.band === b).length}`,
    ).join(' ');
    log(`wrote ${stories.length} stories in ${series.length} series (${perBand})`);
  }
  if (failed) {
    log('some stories failed validation');
    process.exitCode = 1;
  }
}

await main();
