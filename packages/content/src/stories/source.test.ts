import { describe, expect, it } from 'vitest';

import { parseStorySource } from './source';

describe('parseStorySource', () => {
  it('reads the title, names and paragraphs', () => {
    const source = parseStorySource(
      [
        '# a comment',
        'title: La casa | The house',
        'names: Luca, Sara',
        '',
        'Luca ha una casa. | Luca has a house.',
        'La casa è bella. | The house is nice.',
        '',
        '',
        'Sara non ha una casa. | Sara has no house.',
        '',
      ].join('\n'),
    );
    expect(source.title).toEqual({ it: 'La casa', en: 'The house' });
    expect(source.names).toEqual(['Luca', 'Sara']);
    expect(source.paragraphs).toEqual([
      [
        { it: 'Luca ha una casa.', en: 'Luca has a house.' },
        { it: 'La casa è bella.', en: 'The house is nice.' },
      ],
      [{ it: 'Sara non ha una casa.', en: 'Sara has no house.' }],
    ]);
  });

  it('only reads headers before the first sentence', () => {
    const source = parseStorySource('title: A | B\n\nUno. | One.\nnames: x | y\n');
    expect(source.names).toEqual([]);
    expect(source.paragraphs).toEqual([
      [
        { it: 'Uno.', en: 'One.' },
        { it: 'names: x', en: 'y' },
      ],
    ]);
  });

  it('rejects lines without exactly one translation', () => {
    expect(() => parseStorySource('title: A | B\n\nSolo italiano.')).toThrow(/line 3/);
    expect(() => parseStorySource('title: A | B\n\nUno | due | tre')).toThrow(/line 3/);
    expect(() => parseStorySource('Ciao. | Hi.')).toThrow(/title/);
    expect(() => parseStorySource('title: A | B\n')).toThrow(/no sentences/);
  });

  it('reads comprehension questions after "questions:"', () => {
    const source = parseStorySource(
      [
        'title: A | B',
        '',
        'Uno. | One.',
        '',
        'questions:',
        '? Quanti? | How many?',
        '- Due. | Two.',
        '* Uno. | One.',
        '',
        '? Chi? | Who?',
        '* Io. | Me.',
        '- Tu. | You.',
        '- Lei. | Her.',
      ].join('\n'),
    );
    expect(source.paragraphs).toEqual([[{ it: 'Uno.', en: 'One.' }]]);
    expect(source.questions).toEqual([
      {
        prompt: { it: 'Quanti?', en: 'How many?' },
        options: [
          { it: 'Due.', en: 'Two.' },
          { it: 'Uno.', en: 'One.' },
        ],
        answer: 1,
      },
      {
        prompt: { it: 'Chi?', en: 'Who?' },
        options: [
          { it: 'Io.', en: 'Me.' },
          { it: 'Tu.', en: 'You.' },
          { it: 'Lei.', en: 'Her.' },
        ],
        answer: 0,
      },
    ]);
    expect(parseStorySource('title: A | B\n\nUno. | One.\n').questions).toEqual([]);
  });

  it('rejects malformed questions', () => {
    const q = (lines: string[]) =>
      parseStorySource(['title: A | B', '', 'Uno. | One.', 'questions:', ...lines].join('\n'));
    expect(() => q(['- Due. | Two.'])).toThrow(/line 5/);
    expect(() => q(['? Quanti? | How many?', '- Due. | Two.', '- Tre. | Three.'])).toThrow(
      /one "\*" answer/,
    );
    expect(() => q(['? Quanti? | How many?', '* Uno. | One.'])).toThrow(/one "\*" answer/);
    expect(() => q(['? Quanti? | How many?', '* Uno. | One.', '* Due. | Two.'])).toThrow(
      /one right answer/,
    );
    expect(() => q(['? Quanti? | How many?', 'Uno. | One.'])).toThrow(/line 6/);
  });
});
