/**
 * Download cache for source files. Files live in `packages/content/.cache/`
 * (git-ignored); their sha256 digests live in `sources.lock.json` (committed),
 * so a rebuild either uses byte-identical inputs or fails loudly.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ReadableStream as NodeReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';

import { SOURCES, type SourceFile, type SourceId } from './sources';

export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = join(PACKAGE_DIR, '.cache');
export const LOCK_PATH = join(PACKAGE_DIR, 'sources.lock.json');

export interface LockEntry {
  url: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
}

export type LockFile = Record<string, LockEntry>;

export async function readLock(): Promise<LockFile> {
  if (!existsSync(LOCK_PATH)) return {};
  return JSON.parse(await readFile(LOCK_PATH, 'utf8')) as LockFile;
}

export async function writeLock(lock: LockFile): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(LOCK_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export function sourceById(id: SourceId): SourceFile {
  const source = SOURCES.find((s) => s.id === id);
  if (!source) throw new Error(`Unknown source ${id}`);
  return source;
}

export function cachePath(id: SourceId): string {
  return join(CACHE_DIR, sourceById(id).file);
}

async function download(source: SourceFile, dest: string): Promise<void> {
  const response = await fetch(source.url, {
    redirect: 'follow',
    headers: { 'user-agent': 'curl/8.5.0', accept: '*/*' },
  });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${source.url} failed: ${response.status} ${response.statusText}`);
  }
  const partial = `${dest}.partial`;
  await pipeline(Readable.fromWeb(response.body as NodeReadableStream), createWriteStream(partial));
  await rename(partial, dest);
}

/**
 * Make sure every source is in the cache and matches the lock.
 *
 * @param refresh - re-download everything and accept the new digests (use when a
 *   source such as the Tatoeba weekly export has moved on and you want the update).
 */
export async function ensureSources(
  { refresh = false }: { refresh?: boolean } = {},
  log: (message: string) => void = console.log,
): Promise<LockFile> {
  await mkdir(CACHE_DIR, { recursive: true });
  const lock = await readLock();
  for (const source of SOURCES) {
    const dest = join(CACHE_DIR, source.file);
    const locked = lock[source.id];
    if (refresh || !existsSync(dest)) {
      log(`fetch ${source.id} <- ${source.url}`);
      await download(source, dest);
    }
    const sha256 = await sha256File(dest);
    const { size } = await stat(dest);
    if (locked && !refresh && locked.sha256 !== sha256) {
      throw new Error(
        `${source.id}: cached file sha256 ${sha256} does not match sources.lock.json ` +
          `(${locked.sha256}). The upstream file has probably changed. Re-run with ` +
          `--refresh to accept the new version, then review the seed diff.`,
      );
    }
    if (locked?.sha256 !== sha256) {
      lock[source.id] = {
        url: source.url,
        sha256,
        bytes: size,
        fetchedAt: new Date().toISOString(),
      };
      log(`lock ${source.id} sha256=${sha256}`);
    } else {
      log(`ok   ${source.id}`);
    }
  }
  await writeLock(lock);
  return lock;
}
