/**
 * Deterministic JSON layouts for story files, so rebuilds produce byte-identical
 * output and diffs stay readable.
 */
import { type StoriesFile, type Story } from './schema';

/**
 * A story file: two-space indentation, with each token, number array and title
 * on one line.
 */
export function serialiseStory(story: Story): string {
  return `${print(story, '')}\n`;
}

function print(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => typeof v !== 'object' || v === null)) return JSON.stringify(value);
    const inner = `${indent}  `;
    return `[\n${value.map((v) => `${inner}${print(v, inner)}`).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (isFlat(value)) return JSON.stringify(value);
    const inner = `${indent}  `;
    return `{\n${entries
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${print(v, inner)}`)
      .join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** Tokens and titles: objects whose values are primitives or number arrays. */
function isFlat(value: object): boolean {
  return Object.values(value).every(
    (v) =>
      v === null ||
      typeof v !== 'object' ||
      (Array.isArray(v) && v.every((x) => typeof x === 'number')),
  );
}

/** The bundle (`seed/stories.v1.json`): one series or story per line. */
export function serialiseStoriesFile(file: StoriesFile): string {
  const rows = (items: readonly unknown[]) =>
    `[\n${items.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
  return [
    '{',
    `  "version": ${JSON.stringify(file.version)},`,
    `  "seedSha256": ${JSON.stringify(file.seedSha256)},`,
    `  "series": ${rows(file.series)},`,
    `  "stories": ${rows(file.stories)}`,
    '}',
    '',
  ].join('\n');
}
