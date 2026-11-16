/**
 * Refresh the grammar points in the committed seed (`seed/seed.v1.json`) from
 * the syllabus in `src/grammar/levels/`, without rebuilding the lemmas and
 * sentences (which needs the large downloaded sources). `generatedAt` changes
 * only when the grammar changed, so the app re-imports the seed then.
 *
 * Run `pnpm build:stories` afterwards: it re-tags the stories with the current
 * grammar rules and rewrites `seed/manifest.json` with the new checksums.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { serialiseSeed } from './serialise-seed';
import { grammarSeedRows } from '../src/grammar/seedRows';
import { SEED_FILE } from '../src/node';
import { type Seed, SeedSchema } from '../src/schema';

async function main() {
  const previous = SeedSchema.parse(JSON.parse(await readFile(SEED_FILE, 'utf8')));
  const grammarPoints = grammarSeedRows();
  const next: Seed = { ...previous, grammarPoints };
  const unchanged =
    serialiseSeed({ ...next, generatedAt: '' }) === serialiseSeed({ ...previous, generatedAt: '' });
  if (unchanged) {
    console.log('grammar unchanged');
    return;
  }
  const seed = SeedSchema.parse({ ...next, generatedAt: new Date().toISOString() });
  await writeFile(SEED_FILE, serialiseSeed(seed));
  console.log(`wrote ${String(grammarPoints.length)} grammar points to ${SEED_FILE}`);
}

await main();
