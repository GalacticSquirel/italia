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

/** Absolute path of the committed seed file. */
export const SEED_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'seed',
  `seed.v${SEED_VERSION}.json`,
);

/** Read and validate a seed file (defaults to the committed seed). */
export async function loadSeedFile(path: string = SEED_FILE): Promise<Seed> {
  return parseSeed(JSON.parse(await readFile(path, 'utf8')));
}
