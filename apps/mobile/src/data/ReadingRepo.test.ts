import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';

import { addToReviews } from './addToReviews';
import { createRepositories, type Repositories } from './repositories';
import { at, schedule } from './testing/fixtures';

let t: TestDatabase;
let repos: Repositories;

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db);
});

afterEach(() => {
  t.close();
});

describe('ReadingRepo', () => {
  it('tracks opening, position and finished readings', () => {
    expect(repos.reading.get('s-01')).toBeNull();
    const opened = repos.reading.open('s-01', at(0));
    expect(opened).toMatchObject({ storyId: 's-01', completedAt: null, timesRead: 0 });
    repos.reading.open('s-01', at(5));
    expect(repos.reading.get('s-01')?.startedAt).toEqual(at(0));

    repos.reading.savePosition('s-01', 3, at(6));
    expect(repos.reading.get('s-01')?.lastSentence).toBe(3);
    expect(repos.reading.readStoryIds()).toEqual(new Set());

    const read = repos.reading.markRead(
      's-01',
      {
        wordsRead: 120,
        exposures: new Map([
          [1, 4],
          [2, 1],
        ]),
        comprehension: { correct: 2, total: 3 },
      },
      at(10),
    );
    expect(read).toMatchObject({
      completedAt: at(10),
      timesRead: 1,
      wordsRead: 120,
      lastSentence: 0,
      comprehensionCorrect: 2,
      comprehensionTotal: 3,
    });
    expect(repos.reading.readStoryIds()).toEqual(new Set(['s-01']));

    // Reading again keeps the first completion and adds words and exposures.
    repos.reading.markRead(
      's-01',
      { wordsRead: 120, exposures: new Map([[1, 4]]), comprehension: null },
      at(20),
    );
    expect(repos.reading.get('s-01')).toMatchObject({
      completedAt: at(10),
      timesRead: 2,
      wordsRead: 240,
      comprehensionCorrect: 2,
    });
    expect(repos.reading.exposureCount(1)).toBe(8);
    expect(repos.reading.exposureCount(3)).toBe(0);
    expect(repos.reading.exposureCounts([1, 2, 3])).toEqual(
      new Map([
        [1, 8],
        [2, 1],
        [3, 0],
      ]),
    );
    expect(repos.reading.totals()).toEqual({ storiesRead: 1, wordsRead: 240, lemmasMet: 2 });
  });

  it('marks a story read without opening it first, and rejects bad counts', () => {
    repos.reading.markRead(
      's-02',
      { wordsRead: 5, exposures: new Map(), comprehension: null },
      at(1),
    );
    expect(repos.reading.totals()).toEqual({ storiesRead: 1, wordsRead: 5, lemmasMet: 0 });
    expect(() =>
      repos.reading.markRead(
        's-03',
        { wordsRead: -1, exposures: new Map(), comprehension: null },
        at(1),
      ),
    ).toThrow(RangeError);
    expect(repos.reading.get('s-03')).toBeNull();
  });
});

describe('addToReviews', () => {
  const input = {
    kind: 'cloze_production' as const,
    targetId: 7,
    promptMode: 'typed' as const,
    schedule: schedule(),
  };

  it('creates the card with its deterministic id, then leaves it alone', () => {
    expect(addToReviews(repos.cards, input, at(0))).toBe('added');
    const card = repos.cards.getById('cloze_production:7:typed');
    expect(card).toMatchObject({ state: 'new', suspended: false, createdAt: at(0) });
    expect(addToReviews(repos.cards, input, at(1))).toBe('already');
  });

  it('unsuspends a suspended card instead of resetting it', () => {
    repos.cards.create({ ...input, schedule: schedule({ state: 'review', reps: 4 }) });
    repos.cards.suspend('cloze_production:7:typed', true, at(0));
    expect(addToReviews(repos.cards, input, at(1))).toBe('restored');
    expect(repos.cards.getById('cloze_production:7:typed')).toMatchObject({
      suspended: false,
      state: 'review',
      reps: 4,
    });
  });
});
