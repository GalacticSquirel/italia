import { render, screen } from '@testing-library/react-native';

import { Markdown, parseInline, parseMarkdown } from './Markdown';
import { ThemeProvider } from './ThemeProvider';

describe('Markdown', () => {
  it('parses headings, bullets, paragraphs and emphasis', () => {
    expect(parseMarkdown('# Title\n\nOne\nline.\n\n- io **sono**\n* tu *sei*')).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'One line.' },
      { type: 'bullet', text: 'io **sono**' },
      { type: 'bullet', text: 'tu *sei*' },
    ]);
    expect(parseInline('parl**o** and *me*')).toEqual([
      { text: 'parl', bold: false, italic: false },
      { text: 'o', bold: true, italic: false },
      { text: ' and ', bold: false, italic: false },
      { text: 'me', bold: false, italic: true },
    ]);
  });

  it('parses tables, skipping the separator row', () => {
    expect(
      parseMarkdown('Forms:\n| | sing. | plur. |\n|---|---|---|\n| m. | **il** | **i** |\nAfter.'),
    ).toEqual([
      { type: 'paragraph', text: 'Forms:' },
      {
        type: 'table',
        rows: [
          ['', 'sing.', 'plur.'],
          ['m.', '**il**', '**i**'],
        ],
      },
      { type: 'paragraph', text: 'After.' },
    ]);
  });

  it('renders a grammar note', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Markdown source={'## Essere\n\n- io **sono**'} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Essere' })).toBeOnTheScreen();
    expect(screen.getByText('sono')).toHaveStyle({ fontWeight: '700' });
  });
});
