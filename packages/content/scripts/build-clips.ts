/**
 * Build an ear-training clip pack from a local copy of Common Voice Italian.
 *
 * Usage:
 *   pnpm --filter @italia/content build:clips -- --cv <dir> --release <name> \
 *     [--alignments <tsv>] [--out <dir>] [--per-word 6]
 *
 * `<dir>` is an extracted Common Voice Italian release (with `validated.tsv`
 * and `clips/`). Common Voice is distributed through the Mozilla Data
 * Collective and needs an account and the dataset terms accepted, so this
 * script never downloads it.
 *
 * Steps: read `validated.tsv` -> select clips for every minimal-pair word
 * (`selectClips`) -> write `selection.tsv` (path, word index, word) for the
 * forced aligner -> with `--alignments` (TSV: path, wordIndex, startMs,
 * endMs), copy the clips, hash them and write `clip-pack.json`.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { MINIMAL_PAIRS } from '@italia/speech';

import {
  buildClipPack,
  parseCommonVoiceTsv,
  selectClips,
  sentenceWords,
  type ClipSelection,
  type ClipTarget,
  type WordTiming,
} from '../src/clips/clipPack';

const { values } = parseArgs({
  options: {
    cv: { type: 'string' },
    release: { type: 'string' },
    alignments: { type: 'string' },
    out: { type: 'string', default: 'build/clips' },
    'per-word': { type: 'string', default: '6' },
  },
});

if (values.cv === undefined || values.release === undefined) {
  console.error('Usage: build-clips --cv <common voice dir> --release <name> [--alignments <tsv>]');
  process.exit(1);
}

const cvDir = values.cv;
const outDir = values.out;

const targets: ClipTarget[] = MINIMAL_PAIRS.flatMap((set) =>
  set.items.map((item) => ({ accented: item.accented, word: item.word })),
);

const rows = parseCommonVoiceTsv(await readFile(join(cvDir, 'validated.tsv'), 'utf8'));
const selections = selectClips(rows, targets, { perWord: Number(values['per-word']) });
await mkdir(join(outDir, 'clips'), { recursive: true });
await writeFile(
  join(outDir, 'selection.tsv'),
  [
    'path\twordIndex\tword\tsentence',
    ...selections.map(
      (s) =>
        `${s.row.path}\t${String(s.wordIndex)}\t${sentenceWords(s.row.sentence)[s.wordIndex] ?? ''}\t${s.row.sentence}`,
    ),
  ].join('\n'),
);
const covered = new Set(selections.map((s) => s.accented));
console.log(
  `Selected ${String(selections.length)} clips for ${String(covered.size)} of ${String(targets.length)} words.`,
);

if (values.alignments === undefined) {
  console.log(`Align the words in ${join(outDir, 'selection.tsv')}, then rerun with --alignments.`);
  process.exit(0);
}

const timings = new Map<string, WordTiming>();
for (const line of (await readFile(values.alignments, 'utf8')).split(/\r?\n/u).slice(1)) {
  const [path, wordIndex, startMs, endMs] = line.split('\t');
  if (path === undefined || wordIndex === undefined) continue;
  timings.set(`${path}#${wordIndex}`, { startMs: Number(startMs), endMs: Number(endMs) });
}

const files = new Map<string, { file: string; sha256: string; sizeBytes: number }>();
for (const s of selections) {
  if (files.has(s.row.path) || !timings.has(`${s.row.path}#${String(s.wordIndex)}`)) continue;
  const data = await readFile(join(cvDir, 'clips', s.row.path));
  await copyFile(join(cvDir, 'clips', s.row.path), join(outDir, 'clips', s.row.path));
  files.set(s.row.path, {
    file: `clips/${s.row.path}`,
    sha256: createHash('sha256').update(data).digest('hex'),
    sizeBytes: data.byteLength,
  });
}

const fileOf = (s: ClipSelection) => {
  const f = files.get(s.row.path);
  if (!f) throw new Error(`clip not copied: ${s.row.path}`);
  return f;
};

const { pack, missingTimings } = buildClipPack(
  {
    name: 'Common Voice Italian',
    release: values.release,
    licence: 'CC0-1.0',
    url: 'https://datacollective.mozillafoundation.org/',
  },
  selections,
  (s) => timings.get(`${s.row.path}#${String(s.wordIndex)}`) ?? null,
  fileOf,
  (id) => createHash('sha256').update(id).digest('hex').slice(0, 12),
);
await writeFile(join(outDir, 'clip-pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
console.log(
  `Wrote ${String(pack.clips.length)} clips; ${String(missingTimings.length)} had no alignment.`,
);
