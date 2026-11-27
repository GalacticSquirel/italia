import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { activateKeepAwakeAsync } from 'expo-keep-awake';

import { createScheduler } from '@italia/core';

import { getContentIndex } from '@/features/study/content';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices, type FakeSpeechOptions } from '@/speech/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { DrillScreen } from './DrillScreen';

let app: TestApp;
const at = new Date(2026, 10, 16, 9, 0, 0);

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

/** A spoken prompt due now; returns its sentence. */
function seedDueSpokenPrompt() {
  const scheduler = createScheduler();
  const past = new Date(at.getTime() - 30 * 86_400_000);
  const sentence = getContentIndex(app.repos).sentencesByLength[0];
  if (!sentence) throw new Error('fixture has no sentences');
  app.repos.cards.createMany([
    {
      kind: 'spoken_prompt',
      targetId: sentence.id,
      promptMode: 'spoken',
      schedule: scheduler.review(scheduler.newCard(past), 'good', past).card,
    },
  ]);
  return sentence;
}

async function renderDrill(options: FakeSpeechOptions, handsFree = false) {
  const services = createFakeSpeechServices(options);
  const onClose = jest.fn();
  await render(
    app.wrap(
      <SpeechProvider services={services}>
        <DrillScreen handsFree={handsFree} onClose={onClose} now={() => at} />
      </SpeechProvider>,
    ),
  );
  return { services, onClose };
}

describe('DrillScreen', () => {
  it('says the cue, grades the spoken answer, plays the model and records the review', async () => {
    const sentence = seedDueSpokenPrompt();
    const user = userEvent.setup();
    const { services, onClose } = await renderDrill({ transcripts: [sentence.it] });

    await user.press(await screen.findByRole('button', { name: 'Start' }));
    await user.press(await screen.findByRole('button', { name: 'Done' }));

    expect(await screen.findByText('Right, and quick')).toBeOnTheScreen();
    expect(screen.getByText(`I heard: “${sentence.it}”`)).toBeOnTheScreen();
    expect(services.audio.spoken[0]).toEqual({
      text: sentence.en,
      options: { language: 'en-GB', rate: 1 },
    });
    // The neural voice is not installed, so the model answer uses the device voice.
    expect(services.audio.spoken.at(-1)?.text).toBe(sentence.it);
    // The pronunciation score is shown separately.
    expect(await screen.findByTestId('pronunciation-result')).toBeOnTheScreen();

    const [log] = app.repos.reviewLogs.listRecent(1);
    expect(log).toMatchObject({ rating: 'easy', answer: sentence.it });

    await user.press(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Drill complete')).toBeOnTheScreen();
    // The day's next step is offered straight away.
    expect(
      screen.getByRole('button', { name: 'Continue: New words and grammar' }),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Take a break' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('prompts one retry after a miss and keeps the first rating', async () => {
    const sentence = seedDueSpokenPrompt();
    const user = userEvent.setup();
    await renderDrill({ transcripts: ['qualcosa di sbagliato', sentence.it] });

    await user.press(await screen.findByRole('button', { name: 'Start' }));
    await user.press(await screen.findByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Try once more: speak now')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('Not this time')).toBeOnTheScreen();
    const [log] = app.repos.reviewLogs.listRecent(1);
    expect(log).toMatchObject({ rating: 'again', answer: 'qualcosa di sbagliato' });
  });

  it('explains the microphone before asking for it', async () => {
    seedDueSpokenPrompt();
    const user = userEvent.setup();
    await renderDrill({ mic: 'undetermined', micAfterRequest: 'granted' });
    expect(await screen.findByText('Allow the microphone')).toBeOnTheScreen();
    expect(screen.getByText(/processed on this phone and never uploaded/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Allow microphone' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeOnTheScreen();
  });

  it('points to the settings when the microphone is blocked', async () => {
    seedDueSpokenPrompt();
    await renderDrill({ mic: 'blocked' });
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });

  it('runs hands-free with the screen kept awake', async () => {
    const sentence = seedDueSpokenPrompt();
    const { services } = await renderDrill({ transcripts: [sentence.it] }, true);
    await waitFor(() => {
      expect(services.recorder.starts).toBe(1);
    });
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
    expect(services.audio.background).toBe(true);
  });

  it('says when there is nothing to practise yet', async () => {
    const { onClose } = await renderDrill({});
    expect(await screen.findByText('Nothing to say yet')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
