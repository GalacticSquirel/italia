/**
 * The plain-text format stories are written in (`stories/<series>/<nn>.txt`):
 *
 * ```text
 * # A comment line.
 * title: La casa di Luca | Luca's house
 * names: Luca, Sara
 *
 * Luca ha una casa. | Luca has a house.
 * La casa è piccola. | The house is small.
 *
 * A blank line starts a new paragraph. | A blank line starts a new paragraph.
 * ```
 *
 * Each body line is one sentence: the Italian, a `|`, and its English translation.
 * `names` lists the proper nouns (characters, places) used in the story; they are
 * tagged as names and left out of coverage, even when they are also words
 * ("Rosa", "Bruno").
 */

export interface StorySourceSentence {
  readonly it: string;
  readonly en: string;
}

export interface StorySource {
  readonly title: { readonly it: string; readonly en: string };
  readonly names: readonly string[];
  readonly paragraphs: readonly (readonly StorySourceSentence[])[];
}

/** Parse a story source file. Throws with the line number on malformed input. */
export function parseStorySource(text: string): StorySource {
  let title: { it: string; en: string } | undefined;
  let names: string[] = [];
  const paragraphs: StorySourceSentence[][] = [];
  let current: StorySourceSentence[] = [];
  const split = (line: string, n: number): [string, string] => {
    const parts = line.split('|').map((p) => p.trim());
    const [it, en] = parts;
    if (parts.length !== 2 || !it || !en) {
      throw new Error(`line ${n}: expected "Italian | English", got "${line}"`);
    }
    return [it, en];
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (line.startsWith('#')) return;
    if (line === '') {
      if (current.length > 0) paragraphs.push(current);
      current = [];
      return;
    }
    const header = /^(title|names):\s*(.*)$/.exec(line);
    if (header && paragraphs.length === 0 && current.length === 0) {
      if (header[1] === 'title') {
        const [it, en] = split(header[2] ?? '', n);
        title = { it, en };
      } else {
        names = (header[2] ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter((x) => x.length > 0);
      }
      return;
    }
    const [it, en] = split(line, n);
    current.push({ it, en });
  });
  if (current.length > 0) paragraphs.push(current);
  if (!title) throw new Error('missing "title:" line');
  if (paragraphs.length === 0) throw new Error('story has no sentences');
  return { title, names, paragraphs };
}
