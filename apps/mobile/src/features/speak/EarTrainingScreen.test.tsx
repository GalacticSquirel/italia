import { render, screen, userEvent } from '@testing-library/react-native';

import { createRng } from '@italia/core';

import { META_KEYS } from '@/data';
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
    expect(screen.getByText(/Using 2 Italian voices/)).toBeOnTheScreen();
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
});
