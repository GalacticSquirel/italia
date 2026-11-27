import { render, screen, userEvent } from '@testing-library/react-native';

import { ACTIVITIES } from '@italia/core';

import { SHADOWING_ROUND } from '@/features/today/dailyPath';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { ShadowingScreen } from './ShadowingScreen';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('ShadowingScreen', () => {
  it('plays the model, records the learner and shows both waveforms and a score', async () => {
    const services = createFakeSpeechServices({ ttsAvailability: 'ready' });
    const user = userEvent.setup();
    await render(
      app.wrap(
        <SpeechProvider services={services}>
          <ShadowingScreen />
        </SpeechProvider>,
      ),
    );
    await user.press(await screen.findByRole('button', { name: 'Listen' }));
    // The neural voice is installed: its audio is played and drawn.
    expect(services.audio.played).toBe(1);
    expect(await screen.findByLabelText('Model waveform')).toBeOnTheScreen();

    await user.press(await screen.findByRole('button', { name: 'Record yourself' }));
    await user.press(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByLabelText('You waveform')).toBeOnTheScreen();
    expect(await screen.findByTestId('pronunciation-result')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Play mine' }));
    expect(services.audio.played).toBe(2);

    await user.press(screen.getByRole('button', { name: 'Next sentence' }));
    expect(screen.getByText(/^Sentence 2 of/)).toBeOnTheScreen();
  });

  it('notes that the model waveform needs the downloaded voice', async () => {
    const services = createFakeSpeechServices();
    const user = userEvent.setup();
    await render(
      app.wrap(
        <SpeechProvider services={services}>
          <ShadowingScreen />
        </SpeechProvider>,
      ),
    );
    await user.press(await screen.findByRole('button', { name: 'Listen' }));
    expect(await screen.findByText(/model waveform needs the downloaded/)).toBeOnTheScreen();
  });

  it('finishes a round after recording five sentences and offers the next step', async () => {
    const services = createFakeSpeechServices();
    const user = userEvent.setup();
    await render(
      app.wrap(
        <SpeechProvider services={services}>
          <ShadowingScreen />
        </SpeechProvider>,
      ),
    );
    for (let i = 0; i < SHADOWING_ROUND; i++) {
      await user.press(await screen.findByRole('button', { name: 'Record yourself' }));
      await user.press(screen.getByRole('button', { name: 'Stop' }));
      await screen.findByLabelText('You waveform');
      if (i < SHADOWING_ROUND - 1) {
        expect(screen.queryByTestId('shadow-round-done')).toBeNull();
        await user.press(screen.getByRole('button', { name: 'Next sentence' }));
      }
    }
    expect(screen.getByTestId('shadow-round-done')).toBeOnTheScreen();
    const activities = app.repos.studySessions
      .listBetween(new Date(0), new Date(Date.now() + 60_000))
      .flatMap((s) => s.activities);
    expect(activities).toEqual([ACTIVITIES.shadowing]);
    await user.press(screen.getByRole('button', { name: 'Next sentence' }));
    expect(screen.queryByTestId('shadow-round-done')).toBeNull();
  });
});
