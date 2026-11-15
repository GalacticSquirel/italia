/**
 * `@italia/content/node`: Node-only helpers (they use `node:fs`, so the app must
 * not import this entry point; it uses `parseSeed` from the main entry instead).
 *
 * @packageDocumentation
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSeed } from './loader';
import { type Seed, SEED_VERSION } from './schema';
import { parseStoriesFile } from './stories/loader';
import { STORIES_VERSION, type StoriesFile } from './stories/schema';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Absolute path of the committed seed file. */
export const SEED_FILE = join(PACKAGE_DIR, 'seed', `seed.v${SEED_VERSION}.json`);

/** Absolute path of the bundled stories file. */
export const STORIES_FILE = join(PACKAGE_DIR, 'seed', `stories.v${STORIES_VERSION}.json`);

/** Absolute path of `seed/manifest.json` (checksums of the bundled files). */
export const MANIFEST_FILE = join(PACKAGE_DIR, 'seed', 'manifest.json');

/** Absolute path of the story sources (`stories/<series>/<nn>.txt` and `.json`). */
export const STORIES_DIR = join(PACKAGE_DIR, 'stories');

/** Read and validate a seed file (defaults to the committed seed). */
export async function loadSeedFile(path: string = SEED_FILE): Promise<Seed> {
  return parseSeed(JSON.parse(await readFile(path, 'utf8')));
}

/** Read and validate a stories file (defaults to the bundled one). */
export async function loadStoriesFile(path: string = STORIES_FILE): Promise<StoriesFile> {
  return parseStoriesFile(JSON.parse(await readFile(path, 'utf8')));
}
