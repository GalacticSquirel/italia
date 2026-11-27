import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { ACTIVITIES, createRng } from '@italia/core';

import { META_KEYS } from '@/data';
import { EAR_TRAINING_ROUND } from '@/features/today/dailyPath';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { EarTrainingScreen } from './EarTrainingScreen';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('EarTrainingScreen', () => {
  it('plays a word with a device voice, checks the choice and saves progress', async () => {
    const services = createFakeSpeechServices();
    const user = userEvent.setup();
    await render(
      app.wrap(
        <SpeechProvider services={services}>
          <EarTrainingScreen rng={createRng(7)} />
        </SpeechProvider>,
      ),
    );
    expect(await screen.findByTestId('limited-voices')).toBeOnTheScreen();
    expect(screen.getByText(/Spoken by 2 Italian voices/)).toBeOnTheScreen();
    expect(screen.getByText('Level 1 of 3')).toBeOnTheScreen();
    const played = services.audio.spoken[0];
    expect(played?.options.language).toBe('it-IT');
    expect(played?.options.voiceId).toMatch(/^voice-/);

    // Pick the option matching the word that was played.
    const choice = screen.getByRole('button', { name: new RegExp(`^${played?.text ?? ''},`) });
    await user.press(choice);
    expect(screen.getByText('Right!')).toBeOnTheScreen();
    expect(screen.getByText('1 of 1 right')).toBeOnTheScreen();
    const saved = JSON.parse(app.repos.meta.get(META_KEYS.hvptStats) ?? '{}') as {
      streak: number;
    };
    expect(saved.streak).toBe(1);

    await user.press(screen.getByRole('button', { name: 'Next' }));
    expect(services.audio.spoken).toHaveLength(2);
    expect(screen.queryByText('Right!')).toBeNull();
  });

  it('finishes a round, records it for the daily path and offers the next step', async () => {
    const services = createFakeSpeechServices();
    const user = userEvent.setup();
    await render(
      app.wrap(
        <SpeechProvider services={services}>
          <EarTrainingScreen rng={createRng(3)} />
        </SpeechProvider>,
      ),
    );
    await screen.findByTestId('limited-voices');
    for (let i = 0; i < EAR_TRAINING_ROUND; i++) {
      const [first] = screen.getAllByRole('button', { name: /, / });
      if (!first) throw new Error('no choices');
      // fireEvent keeps twenty rounds of taps fast.
      await fireEvent.press(first);
      if (i < EAR_TRAINING_ROUND - 1)
        await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByTestId('ear-round-done')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    const activities = app.repos.studySessions
      .listBetween(new Date(0), new Date(Date.now() + 60_000))
      .flatMap((s) => s.activities);
    expect(activities).toEqual([ACTIVITIES.earTraining]);
    expect(screen.getByTestId('handoff')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Keep training' }));
    expect(screen.queryByTestId('ear-round-done')).toBeNull();
  });
});
