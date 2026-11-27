import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { tutorOutput } from '@italia/core/testing';

import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';
import { TutorProvider } from '@/tutor';
import { createFakeTutorPartner } from '@/tutor/testing';

import { ConversationScreen } from './ConversationScreen';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

const opening = tutorOutput('Buongiorno! Cosa prende?');
const recast = tutorOutput('Ah, sei andata a Napoli! Ti è piaciuta?', {
  recast: {
    learnerText: 'ho andato',
    correctedText: 'sono andata',
    errorTags: ['auxiliary-choice'],
  },
  newWords: [{ lemma: 'piaciuta', glossEn: 'liked' }],
  scenarioProgress: { goalsCompleted: ['greet'], done: false },
});

async function renderScreen(
  partner: ReturnType<typeof createFakeTutorPartner>,
  speech = createFakeSpeechServices(),
) {
  const onClose = jest.fn();
  await render(
    app.wrap(
      <SpeechProvider services={speech}>
        <TutorProvider partner={partner}>
          <ConversationScreen
            scenarioId="bar-colazione"
            onClose={onClose}
            now={() => new Date('2026-11-01T10:00:00Z')}
          />
        </TutorProvider>
      </SpeechProvider>,
    ),
  );
  return { onClose, speech };
}

describe('ConversationScreen', () => {
  it('opens the scene, shows a recast, records it as a review and summarises', async () => {
    const partner = createFakeTutorPartner([{ output: opening }, { output: recast }]);
    const user = userEvent.setup();
    const { onClose } = await renderScreen(partner);
    expect(await screen.findByLabelText('Tutor: Buongiorno! Cosa prende?')).toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('Scrivi in italiano…'), 'Ieri ho andato a Napoli.');
    await user.press(screen.getByText('Send'));
    expect(await screen.findByTestId('recast')).toBeOnTheScreen();
    expect(screen.getByText('Better: “sono andata”')).toBeOnTheScreen();
    expect(screen.getByLabelText('You: Ieri ho andato a Napoli.')).toBeOnTheScreen();
    expect(screen.getByText(/1 of 4 goals/)).toBeOnTheScreen();

    // The request carried the tutor context and the history.
    expect(partner.requests).toHaveLength(2);
    expect(partner.requests[1]?.tutor?.scenario.id).toBe('bar-colazione');
    expect(partner.requests[1]?.history.at(-1)).toEqual({
      role: 'learner',
      text: 'Ieri ho andato a Napoli.',
    });

    // The recast became an error record and a review card.
    expect(app.repos.learnerSentences.listAll().map((s) => s.it)).toEqual([
      'Ieri sono andata a Napoli.',
    ]);
    expect(app.repos.errors.countByCategory()).toEqual([
      { category: 'auxiliary-choice', count: 1 },
    ]);

    // Tap a word for its gloss (declared by the tutor).
    await user.press(screen.getByText('piaciuta'));
    expect(screen.getByTestId('gloss-panel')).toBeOnTheScreen();
    expect(screen.getByText('liked')).toBeOnTheScreen();
    expect(screen.getByText('Meaning given by the tutor')).toBeOnTheScreen();

    await user.press(screen.getByText('End'));
    expect(await screen.findByText('Conversation summary')).toBeOnTheScreen();
    expect(screen.getByText('piaciuta · liked')).toBeOnTheScreen();
    // The summary hands over to the day's next step (learning comes first on day one).
    expect(
      screen.getByRole('button', { name: 'Continue: New words and grammar' }),
    ).toBeOnTheScreen();
    await user.press(screen.getByText('Take a break'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an honest error with a retry when a reply cannot be read', async () => {
    const partner = createFakeTutorPartner([
      { truncated: true, text: 'Buon' },
      { output: opening },
    ]);
    const user = userEvent.setup();
    await renderScreen(partner);
    expect(await screen.findByText('The reply was cut off before it finished.')).toBeOnTheScreen();
    await user.press(screen.getByText('Try again'));
    expect(await screen.findByLabelText('Tutor: Buongiorno! Cosa prende?')).toBeOnTheScreen();
  });

  it('sends a spoken message through speech recognition', async () => {
    const partner = createFakeTutorPartner([
      { output: opening },
      { output: tutorOutput('Ecco il suo cappuccino.') },
    ]);
    const speech = createFakeSpeechServices({ transcripts: ['Un cappuccino, per favore.'] });
    const user = userEvent.setup();
    await renderScreen(partner, speech);
    await screen.findByLabelText('Tutor: Buongiorno! Cosa prende?');
    // Tap to start, tap again to stop.
    await user.press(screen.getByTestId('push-to-talk'));
    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording and send')).toBeOnTheScreen();
    });
    expect(speech.stt.received).toEqual([]);
    await user.press(screen.getByTestId('push-to-talk'));
    expect(await screen.findByLabelText('You: Un cappuccino, per favore.')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Tutor: Ecco il suo cappuccino.')).toBeOnTheScreen();
  });

  it('sends when a held press is released', async () => {
    const partner = createFakeTutorPartner([
      { output: opening },
      { output: tutorOutput('Ecco il suo cappuccino.') },
    ]);
    const speech = createFakeSpeechServices({ transcripts: ['Un cappuccino, per favore.'] });
    const user = userEvent.setup();
    await renderScreen(partner, speech);
    await screen.findByLabelText('Tutor: Buongiorno! Cosa prende?');
    await user.longPress(screen.getByTestId('push-to-talk'), { duration: 600 });
    expect(await screen.findByLabelText('You: Un cappuccino, per favore.')).toBeOnTheScreen();
    expect(speech.recorder.starts).toBe(1);
  });

  it('frees the model when the screen closes', async () => {
    const partner = createFakeTutorPartner([{ output: opening }]);
    await renderScreen(partner);
    await screen.findByLabelText('Tutor: Buongiorno! Cosa prende?');
    await act(async () => {
      await screen.unmount();
    });
    expect(partner.unloads).toBe(1);
  });

  it('says so when the scenario does not exist', async () => {
    const partner = createFakeTutorPartner([{ output: opening }]);
    await render(
      app.wrap(
        <SpeechProvider services={createFakeSpeechServices()}>
          <TutorProvider partner={partner}>
            <ConversationScreen scenarioId="nope" onClose={jest.fn()} />
          </TutorProvider>
        </SpeechProvider>,
      ),
    );
    expect(screen.getByText('Scenario not found')).toBeOnTheScreen();
  });
});
