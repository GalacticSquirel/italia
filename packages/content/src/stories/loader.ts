import { type Story, type StoriesFile, StoriesFileSchema } from './schema';

/** Validate parsed `stories.v1.json` data. Throws a `ZodError` on a mismatch. */
export function parseStoriesFile(data: unknown): StoriesFile {
  return StoriesFileSchema.parse(data);
}

/** The `body_json` stored in the `story` table: everything a reader screen needs. */
export interface StoryBody {
  readonly band: Story['band'];
  readonly titleEn: string;
  readonly paragraphs: Story['paragraphs'];
  readonly targetLemmaIds: readonly number[];
  readonly grammarIds: readonly number[];
  readonly questions: Story['questions'];
  readonly wordCount: number;
}

/** A `story` table insert row for a bundled story. */
export interface StoryRow {
  readonly id: string;
  readonly level: Story['level'];
  readonly seriesId: string;
  readonly seriesIndex: number;
  readonly title: string;
  readonly bodyJson: StoryBody;
  readonly audioRef: null;
  /** Filled by the audio phase; see `StoryWordTimingsSchema`. */
  readonly wordTimings: null;
  readonly source: 'bundled';
}

/** Map a story to a `story` table row (the Italian title is the row title). */
export function toStoryRow(story: Story): StoryRow {
  return {
    id: story.id,
    level: story.level,
    seriesId: story.seriesId,
    seriesIndex: story.seriesIndex,
    title: story.title.it,
    bodyJson: {
      band: story.band,
      titleEn: story.title.en,
      paragraphs: story.paragraphs,
      targetLemmaIds: story.targetLemmaIds,
      grammarIds: story.grammarIds,
      questions: story.questions,
      wordCount: story.wordCount,
    },
    audioRef: null,
    wordTimings: null,
    source: 'bundled',
  };
}
