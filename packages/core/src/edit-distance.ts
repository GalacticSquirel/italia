import { accentKey } from './normalise';

/**
 * Optimal string alignment distance (Levenshtein plus adjacent
 * transpositions, each counting as one edit), over Unicode code points.
 */
export function osaDistance(a: string, b: string): number {
  const s = Array.from(a);
  const t = Array.from(b);
  const rows = s.length + 1;
  const cols = t.length + 1;
  const d = new Array<number>(rows * cols).fill(0);
  const at = (i: number, j: number): number => d[i * cols + j] ?? 0;
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      d[i * cols + j] = best;
    }
  }
  return at(rows - 1, cols - 1);
}

/**
 * Kind of a diff segment, for highlighting an answer against the expected
 * text:
 *
 * - `equal`: same on both sides
 * - `accent`: same letters, different or missing accents
 * - `substitute`: different letters
 * - `missing`: in the expected text but not the answer (`given` is empty)
 * - `extra`: in the answer but not the expected text (`expected` is empty)
 */
export type DiffSegmentType = 'equal' | 'accent' | 'substitute' | 'missing' | 'extra';

/**
 * One run of the alignment between an answer and the expected text. Joining
 * every segment's `given` gives the normalised answer; joining every
 * `expected` gives the normalised expected text. Adjacent segments never
 * share a type.
 */
export interface DiffSegment {
  type: DiffSegmentType;
  given: string;
  expected: string;
}

/** Cost of aligning an accent-only difference: cheaper than a substitution. */
const ACCENT_COST = 0.5;

/**
 * Character-level alignment of `given` against `expected`, merged into
 * runs. Accent-only differences are preferred over other substitutions.
 */
export function diffStrings(given: string, expected: string): DiffSegment[] {
  const g = Array.from(given);
  const e = Array.from(expected);
  const rows = g.length + 1;
  const cols = e.length + 1;
  const d = new Array<number>(rows * cols).fill(0);
  const at = (i: number, j: number): number => d[i * cols + j] ?? 0;
  const subCost = (i: number, j: number): number => {
    const a = g[i] ?? '';
    const b = e[j] ?? '';
    if (a === b) return 0;
    return accentKey(a) === accentKey(b) ? ACCENT_COST : 1;
  };
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      d[i * cols + j] = Math.min(
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
        at(i - 1, j - 1) + subCost(i - 1, j - 1),
      );
    }
  }

  const ops: DiffSegment[] = [];
  let i = g.length;
  let j = e.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + subCost(i - 1, j - 1)) {
      const a = g[i - 1] ?? '';
      const b = e[j - 1] ?? '';
      const cost = subCost(i - 1, j - 1);
      const type: DiffSegmentType =
        cost === 0 ? 'equal' : cost === ACCENT_COST ? 'accent' : 'substitute';
      ops.push({ type, given: a, expected: b });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || at(i, j) === at(i, j - 1) + 1)) {
      ops.push({ type: 'missing', given: '', expected: e[j - 1] ?? '' });
      j--;
    } else {
      ops.push({ type: 'extra', given: g[i - 1] ?? '', expected: '' });
      i--;
    }
  }
  ops.reverse();

  const merged: DiffSegment[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last?.type === op.type) {
      last.given += op.given;
      last.expected += op.expected;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}
