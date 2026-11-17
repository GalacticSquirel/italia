/** SQLite's default bound-parameter limit is 32766; keep single statements well below it. */
export const MAX_PARAMS_PER_STATEMENT = 30_000;

/** Ids bound per `IN (...)` query. */
export const MAX_IDS_PER_QUERY = 900;

/** Split `values` into consecutive chunks of at most `size` items. */
export function chunk<T>(values: readonly T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new RangeError('size must be a positive whole number');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}
