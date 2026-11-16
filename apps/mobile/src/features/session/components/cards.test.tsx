import { render, screen, userEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import type { GrammarPointRow, LemmaRow, SentenceRow } from '@/data';
import { ThemeProvider } from '@/ui';

import { RecognitionCard } from './RecognitionCard';
import { TypedPromptCard } from './TypedPromptCard';

const lemma: LemmaRow = {
  id: 11,
  lemma: 'casa',
  pos: 'NOUN',
  freqRank: 11,
  glossEn: 'house, home',
  audioRef: null,
};
const sentence: SentenceRow = {
  id: 2,
  it: 'La casa è grande.',
  en: 'The house is big.',
  lemmaIds: [2, 11, 1, 18],
  grammarIds: [1, 2],
  tokens: [
    [0, 2, 2],
    [3, 7, 11],
    [8, 9, 1],
    [10, 16, 18],
  ],
  source: 'test',
  licence: 'CC0-1.0',
};
const grammar: GrammarPointRow = {
  id: 1,
  title: 'Essere (to be) in the present',
  order: 1,
  prerequisiteIds: [],
  noteMd: 'note',
};

const wrap = (node: React.ReactNode) => <ThemeProvider scheme="light">{node}</ThemeProvider>;

beforeEach(() => {
  jest.mocked(Speech.speak).mockClear();
});

describe('RecognitionCard', () => {
  it('shows the word, meaning and example, plays it in Italian and moves on', async () => {
    const onGotIt = jest.fn();
    const user = userEvent.setup();
    await render(
      wrap(
        <RecognitionCard
          prompt={{ kind: 'recognition', lemma, example: sentence }}
          speechRate={0.9}
          autoPlay
          onGotIt={onGotIt}
        />,
      ),
    );
    expect(screen.getByText('casa')).toBeOnTheScreen();
    expect(screen.getByText('noun')).toBeOnTheScreen();
    expect(screen.getByText('house, home')).toBeOnTheScreen();
    expect(screen.getByText('The house is big.')).toBeOnTheScreen();
    expect(Speech.speak).toHaveBeenCalledWith('casa. La casa è grande.', {
      language: 'it-IT',
      rate: 0.9,
      onDone: undefined,
      onStopped: undefined,
      onError: undefined,
    });
    await user.press(screen.getByRole('button', { name: 'Got it' }));
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });
});

describe('TypedPromptCard', () => {
  const blank = { before: 'La ', answer: 'casa', after: ' è grande.' };

  it('renders a cloze with a blank, the English cue and a hint', async () => {
    await render(
      wrap(
        <TypedPromptCard
          prompt={{ kind: 'cloze_production', lemma, sentence, blank, accepted: ['casa'] }}
          speechRate={1}
          autoPlay={false}
          answered={false}
        />,
      ),
    );
    expect(screen.getByText('Fill in the missing word')).toBeOnTheScreen();
    expect(screen.getByLabelText('Italian sentence: La  blank  è grande.')).toBeOnTheScreen();
    expect(screen.getByText('The house is big.')).toBeOnTheScreen();
    expect(screen.getByText('Hint: house, home')).toBeOnTheScreen();
    expect(screen.queryByText('casa')).toBeNull();
  });

  it('renders a grammar cloze with the grammar point and the base form', async () => {
    await render(
      wrap(
        <TypedPromptCard
          prompt={{
            kind: 'grammar_cloze',
            sentence,
            blank: { before: 'La casa ', answer: 'è', after: ' grande.' },
            baseForm: 'essere',
            grammarPoint: grammar,
            accepted: ['è'],
          }}
          speechRate={1}
          autoPlay={false}
          answered={false}
        />,
      ),
    );
    expect(screen.getByText('Fill in the right form')).toBeOnTheScreen();
    expect(screen.getByText('Essere (to be) in the present')).toBeOnTheScreen();
    expect(screen.getByLabelText('Use a form of essere')).toBeOnTheScreen();
  });

  it('renders a grammar drill with its translation and hint, not the answer', async () => {
    await render(
      wrap(
        <TypedPromptCard
          prompt={{
            kind: 'grammar_drill',
            drill: {
              id: 2301,
              pointId: 23,
              before: 'Ieri Giulia ',
              answer: 'è andata',
              after: ' al mare.',
              it: 'Ieri Giulia è andata al mare.',
              en: 'Yesterday Giulia went to the seaside.',
              hint: 'andare (passato prossimo)',
              accepted: ['è andata'],
            },
            blank: { before: 'Ieri Giulia ', answer: 'è andata', after: ' al mare.' },
            grammarPoint: grammar,
            accepted: ['è andata'],
          }}
          speechRate={1}
          autoPlay={false}
          answered={false}
        />,
      ),
    );
    expect(screen.getByText('Fill in the gap')).toBeOnTheScreen();
    expect(screen.getByText('Yesterday Giulia went to the seaside.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hint: andare (passato prossimo)')).toBeOnTheScreen();
    expect(screen.queryByText(/è andata/)).toBeNull();
  });

  it('renders sentence production as an English sentence to translate', async () => {
    await render(
      wrap(
        <TypedPromptCard
          prompt={{ kind: 'sentence_production', sentence, accepted: [sentence.it] }}
          speechRate={1}
          autoPlay={false}
          answered={false}
        />,
      ),
    );
    expect(screen.getByText('Say it in Italian')).toBeOnTheScreen();
    expect(screen.getByLabelText('English sentence: The house is big.')).toBeOnTheScreen();
    expect(screen.queryByText(sentence.it)).toBeNull();
  });

  it('plays dictation audio without showing the sentence, at normal and slow speed', async () => {
    const user = userEvent.setup();
    await render(
      wrap(
        <TypedPromptCard
          prompt={{ kind: 'dictation', sentence, accepted: [sentence.it] }}
          speechRate={1}
          autoPlay
          answered={false}
        />,
      ),
    );
    expect(screen.getByText('Type what you hear')).toBeOnTheScreen();
    expect(screen.queryByText(sentence.it)).toBeNull();
    expect(Speech.speak).toHaveBeenCalledWith(sentence.it, expect.objectContaining({ rate: 1 }));
    await user.press(screen.getByRole('button', { name: 'Play slowly' }));
    expect(Speech.speak).toHaveBeenLastCalledWith(
      sentence.it,
      expect.objectContaining({ language: 'it-IT', rate: 0.7 }),
    );
  });
});
