/** Reads the cached Morph-it! archive (shared by the seed and story builds). */
import { spawn } from 'node:child_process';

import { cachePath } from './cache';

export function run(command: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${command} ${args.join(' ')} exited with ${String(code)}`));
    });
  });
}

/** The Morph-it! word list (latin-1) from `.cache/morph-it.tgz`. */
export async function readMorphIt(): Promise<string> {
  const archive = cachePath('morph-it');
  const listing = (await run('tar', ['-tzf', archive])).toString('utf8').split(/\r?\n/);
  const member = listing.find((m) => /morph-it_\d+\.txt$/.test(m));
  if (!member) throw new Error('morph-it.tgz has no morph-it_*.txt');
  return (await run('tar', ['-xzOf', archive, member])).toString('latin1');
}
