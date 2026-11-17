/**
 * Download every source into `.cache/` and verify or record its sha256.
 *
 * Usage: `pnpm --filter @italia/content fetch:sources [--refresh]`
 */
import { ensureSources } from './cache';

await ensureSources({ refresh: process.argv.includes('--refresh') });
