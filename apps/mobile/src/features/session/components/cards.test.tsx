import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { GrammarPointRow, LemmaRow, SentenceRow } from '@/data';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
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

let speech = createFakeSpeechServices();

const wrap = (node: React.ReactNode) => (
  <ThemeProvider scheme="light">
    <SpeechProvider services={speech}>{node}</SpeechProvider>
  </ThemeProvider>
);

beforeEach(() => {
  speech = createFakeSpeechServices();
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
    await waitFor(() => {
      expect(speech.audio.spoken.map((s) => [s.text, s.options])).toEqual([
        ['casa', { language: 'it-IT', rate: 0.9 }],
        ['La casa è grande.', { language: 'it-IT', rate: 0.9 }],
      ]);
    });
    await user.press(screen.getByRole('button', { name: 'Got it' }));
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });
});

describe('ListenButton', () => {
  it('credits a native speaker when their recording plays', async () => {
    speech = createFakeSpeechServices({
      clips: {
        casa: { credit: { by: 'LangPao', licence: 'CC BY-SA 4.0', source: 'https://c/1' } },
      },
    });
    await render(
      wrap(
        <RecognitionCard
          prompt={{ kind: 'recognition', lemma, example: null }}
          speechRate={1}
          autoPlay
          onGotIt={jest.fn()}
        />,
      ),
    );
    expect(
      await screen.findByText('Said by LangPao · Lingua Libre, CC BY-SA 4.0'),
    ).toBeOnTheScreen();
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
    await waitFor(() => {
      expect(speech.audio.spoken.at(-1)).toEqual({
        text: sentence.it,
        options: { language: 'it-IT', rate: 1 },
      });
    });
    await user.press(screen.getByRole('button', { name: 'Play slowly' }));
    await waitFor(() => {
      expect(speech.audio.spoken.at(-1)?.options.rate).toBe(0.7);
    });
  });

  it('plays the pre-recorded clip when a pack has one', async () => {
    speech = createFakeSpeechServices({ clips: { [sentence.it]: {} } });
    const user = userEvent.setup();
    await render(
      wrap(
        <TypedPromptCard
          prompt={{ kind: 'dictation', sentence, accepted: [sentence.it] }}
          speechRate={1}
          autoPlay={false}
          answered={false}
        />,
      ),
    );
    await user.press(screen.getByRole('button', { name: 'Play slowly' }));
    await waitFor(() => {
      expect(speech.audio.playedClips).toEqual([
        {
          clip: { kind: 'file', uri: 'file:///clips/La%20casa%20%C3%A8%20grande..m4a' },
          rate: 0.7,
        },
      ]);
    });
    expect(speech.audio.spoken).toEqual([]);
  });
});
