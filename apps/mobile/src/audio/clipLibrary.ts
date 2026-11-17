/**
 * Pre-recorded clips from downloaded audio packs (manifest kind
 * `audio-pack`, built by `audio/` in the repository).
 *
 * Each installed pack has shard folders `sNNN/` holding `index.json` and the
 * clip files. The library reads the indexes lazily, re-reading them when the
 * set of installed packs changes, and finds a clip by hashing the text to be
 * said ({@link clipKey}). When several recordings exist (native speakers, or
 * two voices) it rotates through them on each play, so the learner hears more
 * than one speaker; recordings by real people come first.
 */
import { z } from 'zod';

import { clipKey, sha256Hex } from './clipKey';

/** Who speaks a pack. */
export interface ClipVoice {
  id: string;
  name: string;
  gender: string;
  /** True when every clip is a recording of a real person. */
  native: boolean;
}

/** When a word is said, over the normalised text (characters end-exclusive). */
export interface ClipTiming {
  charStart: number;
  charEnd: number;
  startMs: number;
  endMs: number;
}

/** Credit for a recording by a real person. */
export interface ClipCredit {
  by: string;
  licence: string;
  source: string;
}

/** A clip ready to play. */
export interface Clip {
  uri: string;
  durationMs: number;
  /** Word timings (story sentences), or null. */
  timings: ClipTiming[] | null;
  packId: string;
  /** The pack's voice (for native packs, the fallback synthetic voice). */
  voice: ClipVoice;
  /** Set when this clip is a native speaker's recording. */
  credit: ClipCredit | null;
}

/** Which recording to prefer. */
export interface ClipQuery {
  /** Only this pack's clips (for example one voice for a whole story). */
  packId?: string;
}

const ClipEntrySchema = z.object({
  f: z.string().min(1),
  ms: z.number().nonnegative(),
  w: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).optional(),
  by: z.string().optional(),
  lic: z.string().optional(),
  src: z.string().optional(),
});

const ShardIndexSchema = z.object({
  format: z.literal(1),
  pack: z.string(),
  shard: z.string().regex(/^s\d{3}$/),
  voice: z.object({
    id: z.string(),
    name: z.string(),
    gender: z.string(),
    native: z.boolean(),
  }),
  clips: z.record(z.string(), z.array(ClipEntrySchema)),
});

/** A downloaded pack: its id, folder and archive file names. */
export interface InstalledPack {
  id: string;
  dir: string;
  files: readonly string[];
}

/** What the library needs from the app (faked in tests). */
export interface ClipLibraryDeps {
  /** Installed audio packs. */
  installed(): InstalledPack[];
  /** Read a small text file; rejects when missing. */
  readText(uri: string): Promise<string>;
}

/** `audio-voice-sara-s003.tar.zst` -> `s003`. */
export function shardOf(fileName: string): string | null {
  const match = /-(s\d{3})\.tar\.zst$/.exec(fileName);
  return match?.[1] ?? null;
}

interface Entry {
  pack: InstalledPack;
  voice: ClipVoice;
  shard: string;
  clip: z.infer<typeof ClipEntrySchema>;
}

interface Loaded {
  map: Map<string, Entry[]>;
  voices: Map<string, ClipVoice>;
}

/** Packs that read sentences and stories (one voice each) start with this. */
export const SENTENCE_PACK_PREFIX = 'audio-voice-';

/** The library of downloaded clips. */
export interface ClipLibrary {
  /** A clip of `text`, or null when no installed pack has one. */
  lookup(text: string, query?: ClipQuery): Promise<Clip | null>;
  /** Installed sentence voices, for choosing a story's reader. */
  voices(): Promise<{ packId: string; voice: ClipVoice }[]>;
  /** Forget loaded indexes (call when packs are installed or removed). */
  reset(): void;
}

/** Create a {@link ClipLibrary}. */
export function createClipLibrary(deps: ClipLibraryDeps): ClipLibrary {
  let loaded: { signature: string; entries: Promise<Loaded> } | null = null;
  const plays = new Map<string, number>();

  const signature = (packs: InstalledPack[]) =>
    packs.map((p) => `${p.id}:${p.files.join(',')}`).join('|');

  async function load(packs: InstalledPack[]): Promise<Loaded> {
    const map = new Map<string, Entry[]>();
    const voices = new Map<string, ClipVoice>();
    for (const pack of [...packs].sort((a, b) => a.id.localeCompare(b.id))) {
      for (const file of pack.files) {
        const shard = shardOf(file);
        if (shard === null) continue;
        let index: z.infer<typeof ShardIndexSchema>;
        try {
          index = ShardIndexSchema.parse(
            JSON.parse(await deps.readText(`${pack.dir}/${shard}/index.json`)),
          );
        } catch {
          continue; // A damaged shard only loses its own clips.
        }
        voices.set(pack.id, index.voice);
        for (const [key, clips] of Object.entries(index.clips)) {
          const list = map.get(key) ?? [];
          for (const clip of clips) list.push({ pack, voice: index.voice, shard, clip });
          map.set(key, list);
        }
      }
    }
    return { map, voices };
  }

  function entries(): Promise<Loaded> {
    const packs = deps.installed();
    const sig = signature(packs);
    if (loaded?.signature !== sig) loaded = { signature: sig, entries: load(packs) };
    return loaded.entries;
  }

  function toClip(e: Entry): Clip {
    const { clip } = e;
    const credit =
      clip.by !== undefined
        ? { by: clip.by, licence: clip.lic ?? '', source: clip.src ?? '' }
        : null;
    return {
      uri: `${e.pack.dir}/${e.shard}/${clip.f}`,
      durationMs: clip.ms,
      timings: clip.w
        ? clip.w.map(([charStart, charEnd, startMs, endMs]) => ({
            charStart,
            charEnd,
            startMs,
            endMs,
          }))
        : null,
      packId: e.pack.id,
      voice: e.voice,
      credit,
    };
  }

  return {
    async lookup(text, query = {}) {
      const key = clipKey(text);
      let found = (await entries()).map.get(key) ?? [];
      if (query.packId !== undefined) {
        const own = found.filter((e) => e.pack.id === query.packId);
        if (own.length > 0) found = own;
      }
      if (found.length === 0) return null;
      const native = found.filter((e) => e.clip.by !== undefined);
      const pool = native.length > 0 ? native : found;
      // Start at a place that depends on the text, then rotate on each play.
      const start = parseInt(sha256Hex(key).slice(0, 6), 16);
      const n = plays.get(key) ?? 0;
      plays.set(key, n + 1);
      const chosen = pool[(start + n) % pool.length];
      return chosen ? toClip(chosen) : null;
    },
    async voices() {
      const { voices } = await entries();
      return [...voices]
        .filter(([packId]) => packId.startsWith(SENTENCE_PACK_PREFIX))
        .map(([packId, voice]) => ({ packId, voice }));
    },
    reset() {
      loaded = null;
    },
  };
}
