import { render, screen, userEvent } from '@testing-library/react-native';

import type { SentenceRow } from '@/data';
import type { SpokenPrompt } from '@/features/study/prompts';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices, type FakeSpeechOptions } from '@/speech/testing';
import { ThemeProvider } from '@/ui';

import { SpokenPromptCard } from './SpokenPromptCard';

const sentence = { id: 1, it: 'Sono a casa.', en: 'I am at home.' } as SentenceRow;
const prompt: SpokenPrompt = { kind: 'spoken_prompt', sentence, accepted: [sentence.it] };

async function renderCard(options: FakeSpeechOptions) {
  const onAnswered = jest.fn();
  const onTypeInstead = jest.fn();
  await render(
    <ThemeProvider scheme="light">
      <SpeechProvider services={createFakeSpeechServices(options)}>
        <SpokenPromptCard
          cardId="spoken_prompt:1:spoken"
          prompt={prompt}
          speechRate={1}
          onAnswered={onAnswered}
          onTypeInstead={onTypeInstead}
        />
      </SpeechProvider>
    </ThemeProvider>,
  );
  return { onAnswered, onTypeInstead };
}

describe('SpokenPromptCard', () => {
  it('reports the graded answer when the learner continues', async () => {
    const user = userEvent.setup();
    const { onAnswered } = await renderCard({ transcripts: ['sono a casa'] });
    await user.press(await screen.findByRole('button', { name: 'Start' }));
    await user.press(await screen.findByRole('button', { name: 'Done' }));
    await user.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(onAnswered).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'spoken_prompt:1:spoken', transcript: 'sono a casa' }),
    );
  });

  it('offers typing instead, with or without the microphone', async () => {
    const user = userEvent.setup();
    const first = await renderCard({});
    await user.press(await screen.findByRole('button', { name: 'Type instead' }));
    expect(first.onTypeInstead).toHaveBeenCalled();
    await screen.unmount();

    const blocked = await renderCard({ mic: 'blocked' });
    await user.press(await screen.findByRole('button', { name: 'Type instead' }));
    expect(blocked.onTypeInstead).toHaveBeenCalled();
  });
});
