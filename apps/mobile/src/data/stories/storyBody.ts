/**
 * The `story.body_json` the app stores for a bundled story: the reader's
 * paragraphs and tags from `@italia/content`, plus the series' title and
 * premise (the library shows them; there is no series table).
 */
import type { StoryBody, StoryParagraph, StorySentence } from '@italia/content';

import type { StoryRow } from '../rows';

/** Format of {@link StoredStoryBody}; bump when its shape changes. */
export const STORY_BODY_FORMAT = 1;

/** Series details stored with each of its stories. */
export interface StoredSeries {
  titleIt: string;
  titleEn: string;
  /** One line on the premise. */
  blurb: string;
}

/** What `story.body_json` holds. */
export interface StoredStoryBody extends StoryBody {
  format: typeof STORY_BODY_FORMAT;
  series: StoredSeries;
}

export type { StoryParagraph, StorySentence };

/**
 * The stored body of a story row, or null when it is not in the current
 * format (for example a story written by an older app version).
 */
export function storyBodyOf(row: Pick<StoryRow, 'bodyJson'>): StoredStoryBody | null {
  const body = row.bodyJson;
  if (typeof body !== 'object' || body === null) return null;
  if ((body as { format?: unknown }).format !== STORY_BODY_FORMAT) return null;
  return body as StoredStoryBody;
}
