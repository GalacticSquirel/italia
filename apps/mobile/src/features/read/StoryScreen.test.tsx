import { render, screen, userEvent, within } from '@testing-library/react-native';

import { createScheduler } from '@italia/core';

import { cardIdFor, importStories } from '@/data';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { FIXTURE_STORIES } from '@/testing/fixtureStories';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { bundledStories, loadLibrary } from './library';
import { startReadingSession } from './readingSession';
import { ReadScreen } from './ReadScreen';
import { StoryScreen } from './StoryScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<{
    useEffect: (effect: () => void, deps: unknown[]) => void;
  }>('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect]);
    },
  };
});

let app: TestApp;
const NOW = new Date();

/** Make the learner know these lemmas (a well-established cloze card each). */
function know(ids: readonly number[]) {
  const scheduler = createScheduler();
  app.repos.cards.createMany(
    ids.map((targetId) => ({
      kind: 'cloze_production' as const,
      targetId,
      promptMode: 'typed' as const,
      schedule: {
        ...scheduler.newCard(NOW),
        state: 'review' as const,
        stability: 60,
        difficulty: 5,
        reps: 6,
        scheduledDays: 60,
        due: new Date(NOW.getTime() + 30 * 86_400_000),
        lastReview: new Date(NOW.getTime() - 86_400_000),
      },
    })),
  );
}

beforeEach(async () => {
  app = await createTestApp();
  importStories(app.t.db, FIXTURE_STORIES);
});

afterEach(() => {
  app.t.close();
});

async function renderStory(id = 'casa-di-marco-01') {
  const services = createFakeSpeechServices();
  const onOpenStory = jest.fn();
  const onClose = jest.fn();
  await render(
    app.wrap(
      <SpeechProvider services={services}>
        <StoryScreen storyId={id} onOpenStory={onOpenStory} onClose={onClose} />
      </SpeechProvider>,
    ),
  );
  return { services, onOpenStory, onClose };
}

describe('library', () => {
  it('recommends nothing to a beginner but names the closest story', async () => {
    const library = loadLibrary(app.repos, NOW);
    expect(library.upNext).toBeNull();
    expect(library.closest).not.toBeNull();
    expect(library.series.map((s) => s.episodes.map((e) => e.locked))).toEqual([
      [false, true],
      [false, true],
    ]);

    const onOpenStory = jest.fn();
    const user = userEvent.setup();
    await render(app.wrap(<ReadScreen onOpenStory={onOpenStory} />));
    expect(screen.getByText('No story fits you yet')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try it anyway' }));
    expect(onOpenStory).toHaveBeenCalledTimes(1);
  });

  it('recommends the next unread episode once the words are known, and unlocks the series', async () => {
    know(Array.from({ length: 33 }, (_, i) => i + 1));
    const first = loadLibrary(app.repos, NOW);
    expect(first.upNext?.coverage.ratio).toBe(1);
    expect(first.upNext?.fit).toBe('easy');
    const id = first.upNext?.id ?? '';
    app.repos.reading.markRead(
      id,
      { wordsRead: 10, exposures: new Map(), comprehension: null },
      NOW,
    );
    const next = loadLibrary(app.repos, NOW);
    expect(next.upNext?.id).toBe(id.replace(/01$/, '02'));
    expect(next.upNext?.locked).toBe(false);

    const onOpenStory = jest.fn();
    const user = userEvent.setup();
    await render(app.wrap(<ReadScreen onOpenStory={onOpenStory} />));
    const upNext = screen.getByTestId('up-next');
    expect(within(upNext).getByText('100% of its words known · Easy read')).toBeOnTheScreen();
    await user.press(within(upNext).getByRole('button', { name: /^Read / }));
    expect(onOpenStory).toHaveBeenCalledWith(next.upNext?.id);
  });
});

describe('reader', () => {
  it('opens the word sheet on a tapped word and adds the word to reviews', async () => {
    const user = userEvent.setup();
    await renderStory();
    expect(screen.getByText('A casa')).toBeOnTheScreen();
    await user.press(screen.getAllByRole('button', { name: 'casa' })[0] ?? screen.getByText('x'));
    const sheet = screen.getByTestId('word-sheet');
    expect(within(sheet).getByText('house, home')).toBeOnTheScreen();
    expect(within(sheet).getByText('noun')).toBeOnTheScreen();

    await user.press(within(sheet).getByRole('button', { name: 'Add to reviews' }));
    const card = app.repos.cards.getById(cardIdFor('cloze_production', 11, 'typed'));
    expect(card).toMatchObject({ state: 'new', suspended: false });
    expect(within(sheet).getByText('Added. It comes up in your next session.')).toBeOnTheScreen();
    expect(within(sheet).queryByRole('button', { name: 'Add to reviews' })).toBeNull();
  });

  it('restores a suspended word and explains names', async () => {
    know([11]);
    app.repos.cards.suspend(cardIdFor('cloze_production', 11, 'typed'), true);
    const user = userEvent.setup();
    await renderStory();
    await user.press(screen.getAllByRole('button', { name: 'casa' })[0] ?? screen.getByText('x'));
    await user.press(screen.getByRole('button', { name: 'Restore to reviews' }));
    expect(app.repos.cards.getById(cardIdFor('cloze_production', 11, 'typed'))?.suspended).toBe(
      false,
    );
    await user.press(screen.getByRole('button', { name: 'Close' }));

    await user.press(screen.getAllByRole('button', { name: 'Marco' })[0] ?? screen.getByText('x'));
    expect(screen.getByText(/A name \(of a person or a place\)/)).toBeOnTheScreen();
  });

  it('toggles a sentence translation and hides text in listening-first mode', async () => {
    const user = userEvent.setup();
    await renderStory();
    expect(screen.queryByText('Marco is at home.')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Show the translation of sentence 1' }));
    expect(screen.getByText('Marco is at home.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Hide the translation of sentence 1' }));
    expect(screen.queryByText('Marco is at home.')).toBeNull();

    await user.press(screen.getByRole('button', { name: /^Listening first/ }));
    expect(screen.queryByRole('button', { name: 'casa' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Sentence 1, hidden' }));
    expect(screen.getAllByRole('button', { name: 'casa' })).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Show all text' }));
    expect(screen.getAllByRole('button', { name: 'casa' })).toHaveLength(2);
  });

  it('plays a sentence with the device voice when the neural voice is not installed', async () => {
    const user = userEvent.setup();
    const { services } = await renderStory();
    await user.press(screen.getByRole('button', { name: 'Play sentence 2' }));
    expect(services.audio.spoken.map((s) => s.text)).toContain('La casa è molto bella.');
    expect(
      await screen.findByText(
        /^Device voice · word highlighting estimated from text length · Download recorded audio/,
      ),
    ).toBeOnTheScreen();
  });

  it('runs the comprehension check, then marks the story read and counts the words met', async () => {
    const user = userEvent.setup();
    await renderStory();
    await user.press(screen.getByRole('button', { name: 'Check your understanding' }));
    const check = screen.getByTestId('comprehension-check');
    for (let i = 0; i < 3; i++) {
      const options = within(screen.getByTestId('comprehension-check')).getAllByRole('button');
      const first = options[0];
      if (!first) throw new Error('no options');
      await user.press(first);
      const next = within(screen.getByTestId('comprehension-check')).getByRole('button', {
        name: i === 2 ? 'See result' : 'Next',
      });
      await user.press(next);
    }
    expect(check).toBeTruthy();
    expect(screen.getByTestId('story-done')).toBeOnTheScreen();
    expect(screen.getByText(/You answered \d of 3 questions correctly\./)).toBeOnTheScreen();

    const progress = app.repos.reading.get('casa-di-marco-01');
    expect(progress?.completedAt).not.toBeNull();
    expect(progress?.comprehensionTotal).toBe(3);
    expect(progress?.wordsRead).toBe(21);
    // "casa" occurs twice in the story.
    expect(app.repos.reading.exposureCount(11)).toBe(2);
    expect(app.repos.reading.totals().storiesRead).toBe(1);
  });

  it('marks as read without the check and offers the next episode', async () => {
    const user = userEvent.setup();
    const { onOpenStory } = await renderStory();
    await user.press(screen.getByRole('button', { name: 'Mark as read' }));
    await user.press(screen.getByRole('button', { name: 'Next episode' }));
    expect(onOpenStory).toHaveBeenCalledWith('casa-di-marco-02');
    expect(app.repos.reading.get('casa-di-marco-01')?.comprehensionTotal).toBeNull();
  });
});

describe('reading session', () => {
  it('logs reading time and the story activity in a study session', () => {
    const story = bundledStories(app.repos)[0];
    if (!story) throw new Error('no stories');
    let t = new Date('2026-11-16T09:00:00Z').getTime();
    const ended = jest.fn();
    const session = startReadingSession(app.repos, story, () => new Date(t), ended);
    session.resume();
    t += 2 * 60_000;
    session.touch(1);
    expect(app.repos.reading.get(story.id)?.lastSentence).toBe(1);
    t += 60_000;
    session.finish({ correct: 3, total: 3 });
    session.close();
    const [row] = app.repos.studySessions.listBetween(new Date(0), new Date(t + 1));
    expect(row?.minutesActive).toBeCloseTo(3);
    expect(row?.activities).toEqual(['story']);
    expect(row?.endedAt).not.toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(app.repos.streak.get().day?.completedSessions).toBe(1);
  });

  it('does not create an empty study session', () => {
    const story = bundledStories(app.repos)[0];
    if (!story) throw new Error('no stories');
    const session = startReadingSession(app.repos, story, () => NOW);
    session.resume();
    session.close();
    expect(app.repos.studySessions.getActive()).toBeNull();
    expect(app.repos.studySessions.totalActiveMinutes()).toBe(0);
  });
});
