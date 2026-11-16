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
 *
 * `readings` pins the lemma of a spelling the tagger would otherwise read as
 * another word, for the whole story (its questions included): `readings:
 * costa=costare, urla=urlare` makes "costa" the verb, not "coast"; `lemma|POS`
 * picks between same-spelling lemmas (`salutare=salutare|VERB`). Use it when
 * `build:stories --verbose` reports a wrong `homograph:`.
 *
 * A `questions:` line ends the story text and starts its comprehension
 * questions. Each question is a `?` line followed by its answer options, the
 * correct one marked `*` and the others `-`:
 *
 * ```text
 * questions:
 * ? Che cosa ha Luca? | What does Luca have?
 * - Un cane. | A dog.
 * * Una casa. | A house.
 * - Una macchina. | A car.
 * ```
 */

export interface StorySourceSentence {
  readonly it: string;
  readonly en: string;
}

/** A multiple-choice comprehension question. */
export interface StorySourceQuestion {
  readonly prompt: StorySourceSentence;
  readonly options: readonly StorySourceSentence[];
  /** Index of the correct option. */
  readonly answer: number;
}

export interface StorySource {
  readonly title: { readonly it: string; readonly en: string };
  readonly names: readonly string[];
  /** Lower-case spelling -> the lemma it must be read as. */
  readonly readings: ReadonlyMap<string, string>;
  readonly paragraphs: readonly (readonly StorySourceSentence[])[];
  readonly questions: readonly StorySourceQuestion[];
}

/** Parse a story source file. Throws with the line number on malformed input. */
export function parseStorySource(text: string): StorySource {
  let title: { it: string; en: string } | undefined;
  let names: string[] = [];
  const readings = new Map<string, string>();
  const paragraphs: StorySourceSentence[][] = [];
  let current: StorySourceSentence[] = [];
  let inQuestions = false;
  const questions: {
    prompt: StorySourceSentence;
    options: StorySourceSentence[];
    answer: number;
  }[] = [];
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
    if (inQuestions) {
      if (line === '') return;
      const kind = line[0];
      const rest = line.slice(1).trim();
      if (kind === '?') {
        const [it, en] = split(rest, n);
        questions.push({ prompt: { it, en }, options: [], answer: -1 });
        return;
      }
      const q = questions.at(-1);
      if ((kind !== '*' && kind !== '-') || !q) {
        throw new Error(`line ${n}: expected "? question", "* right answer" or "- wrong answer"`);
      }
      if (kind === '*') {
        if (q.answer >= 0) throw new Error(`line ${n}: a question has one right answer`);
        q.answer = q.options.length;
      }
      const [it, en] = split(rest, n);
      q.options.push({ it, en });
      return;
    }
    if (line === 'questions:') {
      inQuestions = true;
      return;
    }
    if (line === '') {
      if (current.length > 0) paragraphs.push(current);
      current = [];
      return;
    }
    const header = /^(title|names|readings):\s*(.*)$/.exec(line);
    if (header && paragraphs.length === 0 && current.length === 0) {
      if (header[1] === 'title') {
        const [it, en] = split(header[2] ?? '', n);
        title = { it, en };
      } else if (header[1] === 'readings') {
        for (const pair of (header[2] ?? '').split(',')) {
          const m = /^\s*([^\s=]+)\s*=\s*([^\s=|]+(?:\|[A-Z]+)?)\s*$/.exec(pair);
          if (!m?.[1] || !m[2]) throw new Error(`line ${n}: readings are "form=lemma, ..."`);
          readings.set(m[1].toLowerCase(), m[2]);
        }
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
  for (const q of questions) {
    if (q.answer < 0 || q.options.length < 2) {
      throw new Error(`question "${q.prompt.it}" needs one "*" answer and at least one "-" option`);
    }
  }
  return { title, names, readings, paragraphs, questions };
}
