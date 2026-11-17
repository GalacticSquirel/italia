/**
 * Ear-training clip packs: recordings of real speakers saying the words of
 * the minimal pairs, cut from Common Voice (CC0), for high-variability
 * phonetic training.
 *
 * Common Voice clips are whole sentences, so a clip is a source recording
 * plus the span of the target word in it (from a forced alignment). The
 * build is: {@link parseCommonVoiceTsv} on `validated.tsv`, then
 * {@link selectClips} (multi-speaker, well-validated, balanced), then
 * {@link buildClipPack} with word timings. `scripts/build-clips.ts` runs it.
 */
import { z } from 'zod';

/** Clip-pack format version. */
export const CLIP_PACK_VERSION = 1;

/** One clip of one word. */
export const ClipSchema = z.object({
  /** The word as written in the minimal-pair list (teaching spelling for stress and vowel pairs). */
  accented: z.string().min(1),
  /** File in the pack (an MP3 cut, or the source clip when `startMs`/`endMs` are set). */
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  sizeBytes: z.number().int().positive(),
  /** Span of the word in `file`, in milliseconds. */
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  /** Anonymous speaker key (a hash of the Common Voice client id), for talker rotation. */
  speaker: z.string().min(1),
  /** Source clip name in the dataset, for attribution and rebuilding. */
  source: z.string().min(1),
});

/** A clip-pack manifest. */
export const ClipPackSchema = z.object({
  version: z.literal(CLIP_PACK_VERSION),
  dataset: z.object({
    name: z.string(),
    /** Release, for example `cv-corpus-21.0-2025-03-14`. */
    release: z.string(),
    licence: z.literal('CC0-1.0'),
    url: z.url(),
  }),
  clips: z.array(ClipSchema),
});

export type Clip = z.infer<typeof ClipSchema>;
export type ClipPack = z.infer<typeof ClipPackSchema>;

/** A row of Common Voice's `validated.tsv`. */
export interface CommonVoiceRow {
  clientId: string;
  path: string;
  sentence: string;
  upVotes: number;
  downVotes: number;
  gender: string;
}

/** Parse `validated.tsv` (tab-separated, header first); rows missing a column are skipped. */
export function parseCommonVoiceTsv(text: string): CommonVoiceRow[] {
  const lines = text.split(/\r?\n/u).filter((l) => l.length > 0);
  const header = (lines[0] ?? '').split('\t');
  const col = (name: string) => header.indexOf(name);
  const idx = {
    clientId: col('client_id'),
    path: col('path'),
    sentence: col('sentence'),
    up: col('up_votes'),
    down: col('down_votes'),
    gender: col('gender'),
  };
  if (idx.clientId < 0 || idx.path < 0 || idx.sentence < 0) {
    throw new Error('validated.tsv needs client_id, path and sentence columns');
  }
  const rows: CommonVoiceRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const clientId = cells[idx.clientId];
    const path = cells[idx.path];
    const sentence = cells[idx.sentence];
    if (!clientId || !path || !sentence) continue;
    rows.push({
      clientId,
      path,
      sentence,
      upVotes: Number(cells[idx.up] ?? 0) || 0,
      downVotes: Number(cells[idx.down] ?? 0) || 0,
      gender: idx.gender < 0 ? '' : (cells[idx.gender] ?? ''),
    });
  }
  return rows;
}

/** Lower-case words of a sentence, accents kept, apostrophes splitting elisions. */
export function sentenceWords(sentence: string): string[] {
  return sentence
    .normalize('NFC')
    .toLocaleLowerCase('it')
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 0);
}

/** A target word to find clips for. */
export interface ClipTarget {
  /** Key in the pack (the minimal-pair teaching spelling). */
  accented: string;
  /** Spelling as it appears in running text. */
  word: string;
}

/** A selected source clip for a target word. */
export interface ClipSelection {
  accented: string;
  row: CommonVoiceRow;
  /** Index of the word in {@link sentenceWords} of the sentence. */
  wordIndex: number;
}

/** Options for {@link selectClips}. */
export interface SelectOptions {
  /** Clips per word, each from a different speaker. Default 6. */
  perWord?: number;
  /** Least up-votes. Default 2. */
  minUpVotes?: number;
  /** Longest sentence, in words (shorter sentences align better). Default 12. */
  maxWords?: number;
}

/**
 * Choose clips: validated (enough up-votes, no down-votes), one per speaker
 * per word, speakers spread across genders, shorter sentences first. Targets with the
 * same running-text spelling (stress pairs such as *ancora*) can only be
 * told apart after alignment, so they are skipped here.
 */
export function selectClips(
  rows: readonly CommonVoiceRow[],
  targets: readonly ClipTarget[],
  options: SelectOptions = {},
): ClipSelection[] {
  const perWord = options.perWord ?? 6;
  const minUp = options.minUpVotes ?? 2;
  const maxWords = options.maxWords ?? 12;
  const spellings = new Map<string, ClipTarget[]>();
  for (const t of targets) {
    const key = t.word.normalize('NFC').toLocaleLowerCase('it');
    spellings.set(key, [...(spellings.get(key) ?? []), t]);
  }
  const candidates = new Map<string, ClipSelection[]>();
  for (const row of rows) {
    if (row.upVotes < minUp || row.downVotes > 0) continue;
    const words = sentenceWords(row.sentence);
    if (words.length > maxWords) continue;
    words.forEach((w, wordIndex) => {
      const matching = spellings.get(w);
      if (matching?.length !== 1) return;
      const target = matching[0];
      if (!target) return;
      const list = candidates.get(target.accented) ?? [];
      list.push({ accented: target.accented, row, wordIndex });
      candidates.set(target.accented, list);
    });
  }
  const out: ClipSelection[] = [];
  for (const t of targets) {
    const list = [...(candidates.get(t.accented) ?? [])].sort(
      (a, b) =>
        sentenceWords(a.row.sentence).length - sentenceWords(b.row.sentence).length ||
        b.row.upVotes - a.row.upVotes ||
        a.row.path.localeCompare(b.row.path),
    );
    const speakers = new Set<string>();
    const byGender = new Map<string, ClipSelection[]>();
    for (const c of list) {
      if (speakers.has(c.row.clientId)) continue;
      speakers.add(c.row.clientId);
      const g = c.row.gender || 'unknown';
      byGender.set(g, [...(byGender.get(g) ?? []), c]);
    }
    // Round-robin across genders so the talkers vary.
    const groups = [...byGender.entries()].sort(([a], [b]) => a.localeCompare(b));
    const chosen: ClipSelection[] = [];
    for (let i = 0; chosen.length < perWord; i++) {
      let added = false;
      for (const [, g] of groups) {
        const c = g[i];
        if (c && chosen.length < perWord) {
          chosen.push(c);
          added = true;
        }
      }
      if (!added) break;
    }
    out.push(...chosen);
  }
  return out;
}

/** Where a selected word was found in its clip (from a forced alignment). */
export interface WordTiming {
  startMs: number;
  endMs: number;
}

/** A file in the pack, as written by the build. */
export interface PackFile {
  file: string;
  sha256: string;
  sizeBytes: number;
}

/**
 * The pack manifest for selections that have word timings. Selections
 * without a timing are left out and returned, so the build can report them.
 */
export function buildClipPack(
  dataset: ClipPack['dataset'],
  selections: readonly ClipSelection[],
  timing: (s: ClipSelection) => WordTiming | null,
  file: (s: ClipSelection) => PackFile,
  speakerKey: (clientId: string) => string,
): { pack: ClipPack; missingTimings: ClipSelection[] } {
  const clips: Clip[] = [];
  const missingTimings: ClipSelection[] = [];
  for (const s of selections) {
    const t = timing(s);
    if (!t || !(t.endMs > t.startMs)) {
      missingTimings.push(s);
      continue;
    }
    clips.push({
      accented: s.accented,
      ...file(s),
      startMs: t.startMs,
      endMs: t.endMs,
      speaker: speakerKey(s.row.clientId),
      source: s.row.path,
    });
  }
  return {
    pack: ClipPackSchema.parse({ version: CLIP_PACK_VERSION, dataset, clips }),
    missingTimings,
  };
}
