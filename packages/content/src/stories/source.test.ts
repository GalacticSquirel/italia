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
});
