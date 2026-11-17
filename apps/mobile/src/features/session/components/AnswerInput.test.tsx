import { render, screen, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { ACCENTS, AccentBar } from './AccentBar';
import { AnswerInput, insertAt } from './AnswerInput';

describe('insertAt', () => {
  it('inserts at the caret and replaces a selection', () => {
    expect(insertAt('perche', { start: 6, end: 6 }, 'é')).toEqual({
      text: 'percheé',
      selection: { start: 7, end: 7 },
    });
    expect(insertAt('caffe', { start: 4, end: 5 }, 'è')).toEqual({
      text: 'caffè',
      selection: { start: 5, end: 5 },
    });
    expect(insertAt('a', { start: 9, end: 12 }, 'ì').text).toBe('aì');
  });
});

describe('AccentBar', () => {
  it('offers every Italian accented vowel as a labelled 48pt button', async () => {
    const onInsert = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider scheme="dark">
        <AccentBar onInsert={onInsert} />
      </ThemeProvider>,
    );
    for (const char of ACCENTS) expect(screen.getByText(char)).toBeOnTheScreen();
    const key = screen.getByRole('button', { name: 'Type e acute' });
    expect(key).toHaveStyle({ minHeight: 48, minWidth: 48 });
    await user.press(key);
    expect(onInsert).toHaveBeenCalledWith('é');
  });
});

describe('AnswerInput', () => {
  it('types accents into the answer and submits it', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider scheme="light">
        <AnswerInput label="Missing word" onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    await user.type(screen.getByLabelText('Missing word'), 'citt');
    await user.press(screen.getByRole('button', { name: 'Type a grave' }));
    expect(screen.getByLabelText('Missing word')).toHaveDisplayValue('città');
    await user.press(check);
    expect(onSubmit).toHaveBeenCalledWith('città');
  });
});
