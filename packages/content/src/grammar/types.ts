/**
 * Types for the hand-written grammar syllabus (A1 to C2): each point has a short
 * explicit note and a set of practice drills that target exactly that point.
 */

/** CEFR levels the grammar syllabus covers, in order. */
export const GRAMMAR_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** A CEFR level of the grammar syllabus. */
export type GrammarCefr = (typeof GRAMMAR_CEFR_LEVELS)[number];

/**
 * One practice item for a grammar point: an Italian sentence with the part to
 * produce in square brackets, e.g. `Ieri [sono andata] al mare.`
 */
export interface GrammarDrillSource {
  /** Italian sentence with exactly one `[answer]` gap. */
  readonly it: string;
  /** English translation of the whole sentence. */
  readonly en: string;
  /**
   * What the learner should use, shown under the sentence: usually the
   * dictionary form plus a cue, e.g. `andare (passato prossimo, a woman speaking)`.
   */
  readonly hint: string;
  /** Other answers that are also correct for the gap. */
  readonly also?: readonly string[];
}

/** A grammar point as written in the syllabus files. */
export interface GrammarPointSource {
  /** Stable numeric id (the `grammar_point.id`). Never reuse or renumber. */
  readonly id: number;
  /** Stable human-readable key. */
  readonly slug: string;
  readonly title: string;
  readonly cefr: GrammarCefr;
  /** Slugs of points that must be learnt first (all taught earlier). */
  readonly prerequisites: readonly string[];
  /**
   * The explanation, in the Markdown subset the app renders (paragraphs,
   * `-` bullets, `**bold**`, `*italic*`, and `|` tables). It opens with an
   * `**In short:**` line, has a `**Watch out:**` line for the classic mistake,
   * and ends with translated examples.
   */
  readonly noteMd: string;
  /**
   * Practice drills, in teaching order (easiest first). Append only: a drill's
   * id is derived from its position, so never reorder or delete drills; fix a
   * wrong one in place.
   */
  readonly drills: readonly GrammarDrillSource[];
}

/** A drill resolved for use: stable id, owning point, and the gap split out. */
export interface GrammarDrill {
  /** Stable id: `pointId * 100 + position` (position from 1). */
  readonly id: number;
  readonly pointId: number;
  /** Text before the gap. */
  readonly before: string;
  /** The expected answer (the bracketed text). */
  readonly answer: string;
  /** Text after the gap. */
  readonly after: string;
  /** The full Italian sentence without brackets. */
  readonly it: string;
  readonly en: string;
  readonly hint: string;
  /** Every accepted answer, the expected one first. */
  readonly accepted: readonly string[];
}
