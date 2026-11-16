/** Bytes as a short size, for example "670 MB" or "1.2 GB" (decimal units, as phones show). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${String(Math.round(bytes / 1e6))} MB`;
  return `${String(Math.max(1, Math.round(bytes / 1e3)))} KB`;
}
