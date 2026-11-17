import type { SeedGrammarPoint } from '../schema';
import { GRAMMAR_POINTS } from './points';

/**
 * The seed's `grammarPoints` rows: the syllabus in teaching order, with
 * prerequisites resolved to ids. Drills are not in the seed; the app reads
 * them from `GRAMMAR_DRILLS` directly.
 */
export function grammarSeedRows(): SeedGrammarPoint[] {
  const idBySlug = new Map(GRAMMAR_POINTS.map((p) => [p.slug, p.id]));
  return GRAMMAR_POINTS.map((p, i) => ({
    id: p.id,
    title: p.title,
    order: i + 1,
    prerequisiteIds: p.prerequisites.map((slug) => {
      const id = idBySlug.get(slug);
      if (id === undefined) throw new Error(`${p.slug}: unknown prerequisite ${slug}`);
      return id;
    }),
    noteMd: p.noteMd,
    extra: { slug: p.slug, cefr: p.cefr },
  }));
}
