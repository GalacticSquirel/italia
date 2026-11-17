import type { Seed } from '../src/schema';

/** The seed file's text: one row per line, so it stays compact but diffs stay readable. */
export function serialiseSeed(seed: Omit<Seed, 'generatedAt'> & { generatedAt: string }): string {
  const rows = (items: readonly unknown[]) =>
    items.length === 0
      ? '[]'
      : `[\n${items.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
  return [
    '{',
    `  "version": ${JSON.stringify(seed.version)},`,
    `  "generatedAt": ${JSON.stringify(seed.generatedAt)},`,
    `  "sources": ${rows(seed.sources)},`,
    `  "lemmas": ${rows(seed.lemmas)},`,
    `  "sentences": ${rows(seed.sentences)},`,
    `  "grammarPoints": ${rows(seed.grammarPoints)}`,
    '}',
    '',
  ].join('\n');
}
