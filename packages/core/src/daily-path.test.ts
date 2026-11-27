import { describe, expect, it } from 'vitest';

import {
  ACTIVITIES,
  buildDailyPath,
  CONVERSATION_MIN_WORDS,
  type DailyPathInput,
  rotateDaily,
  type DailyStepId,
} from './index';

/** A learner some weeks in: reviews due, new words planned, a story fits, tutor installed. */
const midway: DailyPathInput = {
  reviewsDue: 30,
  newItemsPlanned: 25,
  spokenPromptsReady: 8,
  storyReady: true,
  tutor: 'ready',
  knownWords: 400,
  activitiesToday: [],
  skippedToday: [],
};

/** A complete beginner on day one. */
const firstDay: DailyPathInput = {
  reviewsDue: 0,
  newItemsPlanned: 40,
  spokenPromptsReady: 0,
  storyReady: false,
  tutor: 'needs_download',
  knownWords: 0,
  activitiesToday: [],
  skippedToday: [],
};

const ids = (input: DailyPathInput) => buildDailyPath(input).steps.map((s) => s.id);
const statuses = (input: DailyPathInput) =>
  Object.fromEntries(buildDailyPath(input).steps.map((s) => [s.id, s.status]));

describe('buildDailyPath', () => {
  it('orders reviews, learning, input, speaking and conversation', () => {
    const path = buildDailyPath(midway);
    expect(path.steps.map((s) => [s.id, s.activity])).toEqual([
      ['reviews', ACTIVITIES.reviews],
      ['learn', ACTIVITIES.learn],
      ['listen', ACTIVITIES.story],
      ['speak', ACTIVITIES.speakingDrill],
      ['converse', ACTIVITIES.conversation],
    ]);
    expect(path.next?.id).toBe('reviews');
    expect(path.steps.map((s) => s.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(path.finished).toBe(0);
    expect(path.extra).toBeNull();
  });

  it('gives a beginner words, ear training and shadowing, with stories and the tutor to come', () => {
    const path = buildDailyPath(firstDay);
    expect(path.steps.map((s) => s.activity)).toEqual([
      ACTIVITIES.learn,
      ACTIVITIES.earTraining,
      ACTIVITIES.shadowing,
    ]);
    expect(path.next?.id).toBe('learn');
    expect(path.unlocks).toEqual([
      { step: 'listen', activity: 'story', waitsFor: 'words' },
      {
        step: 'converse',
        activity: 'conversation',
        waitsFor: 'words',
        wordsNeeded: CONVERSATION_MIN_WORDS,
      },
    ]);
  });

  it('moves on as activities are finished', () => {
    const input = { ...midway, reviewsDue: 0, activitiesToday: [ACTIVITIES.reviews] };
    expect(buildDailyPath(input).next?.id).toBe('learn');
    const later = {
      ...input,
      newItemsPlanned: 0,
      activitiesToday: [ACTIVITIES.reviews, ACTIVITIES.learn, ACTIVITIES.story],
    };
    expect(statuses(later)).toEqual({
      reviews: 'done',
      learn: 'done',
      listen: 'done',
      speak: 'current',
      converse: 'upcoming',
    });
    expect(buildDailyPath(later).finished).toBe(3);
  });

  it('keeps a finished review step done when more reviews come due later', () => {
    const input = { ...midway, reviewsDue: 6, activitiesToday: [ACTIVITIES.reviews] };
    expect(statuses(input).reviews).toBe('done');
    expect(buildDailyPath(input).next?.id).toBe('learn');
  });

  it("adds no review step for reviews that come due after the day's learning", () => {
    const input = {
      ...firstDay,
      reviewsDue: 12,
      newItemsPlanned: 0,
      activitiesToday: [ACTIVITIES.learn],
    };
    expect(ids(input)).toEqual(['learn', 'listen', 'speak']);
    expect(buildDailyPath(input).next?.id).toBe('listen');
  });

  it('keeps a study step current after leaving it early', () => {
    expect(buildDailyPath({ ...midway, reviewsDue: 12 }).next?.id).toBe('reviews');
  });

  it('treats a study step with nothing left as done even without a finished session', () => {
    const input = { ...midway, reviewsDue: 0, newItemsPlanned: 0, activitiesToday: ['story'] };
    // Reviews and learning do not apply at all when nothing was due or planned.
    expect(ids(input)).toEqual(['listen', 'speak', 'converse']);
    expect(buildDailyPath(input).next?.id).toBe('speak');
  });

  it('lets the learner skip a step and keeps it out of the way', () => {
    const skippedToday: DailyStepId[] = ['reviews', 'listen'];
    const path = buildDailyPath({ ...midway, skippedToday });
    expect(path.next?.id).toBe('learn');
    expect(statuses({ ...midway, skippedToday }).listen).toBe('skipped');
    expect(path.finished).toBe(2);
  });

  it('marks done over skipped when the learner went back to a skipped step', () => {
    const input = {
      ...midway,
      skippedToday: ['listen' as const],
      activitiesToday: [ACTIVITIES.story],
    };
    expect(statuses(input).listen).toBe('done');
  });

  it('counts ear training or shadowing done earlier even once a story or drill is ready', () => {
    const input = {
      ...midway,
      activitiesToday: [ACTIVITIES.earTraining, ACTIVITIES.shadowing],
    };
    const path = buildDailyPath(input);
    expect(path.steps.find((s) => s.id === 'listen')).toEqual({
      id: 'listen',
      activity: ACTIVITIES.earTraining,
      status: 'done',
    });
    expect(path.steps.find((s) => s.id === 'speak')?.activity).toBe(ACTIVITIES.shadowing);
  });

  it('asks for the tutor download once there are enough words, and leaves it out when unusable', () => {
    const words = { ...midway, tutor: 'needs_download' as const };
    expect(ids(words)).not.toContain('converse');
    expect(buildDailyPath(words).unlocks).toEqual([
      { step: 'converse', activity: 'conversation', waitsFor: 'download' },
    ]);
    const unusable = { ...midway, tutor: 'unavailable' as const };
    expect(buildDailyPath(unusable).unlocks).toEqual([]);
    const fewWords = { ...midway, knownWords: CONVERSATION_MIN_WORDS - 1 };
    expect(ids(fewWords)).not.toContain('converse');
  });

  it('offers the best extra once the path is finished', () => {
    const all = Object.values(ACTIVITIES);
    const done = { ...midway, reviewsDue: 0, newItemsPlanned: 0, activitiesToday: all };
    const path = buildDailyPath(done);
    expect(path.next).toBeNull();
    expect(path.finished).toBe(path.steps.length);
    expect(path.extra).toBe('story');
    expect(buildDailyPath({ ...done, reviewsDue: 4 }).extra).toBe('reviews');
    expect(buildDailyPath({ ...done, storyReady: false }).extra).toBe('speaking_drill');
    expect(buildDailyPath({ ...done, storyReady: false, spokenPromptsReady: 0 }).extra).toBeNull();
  });
});

describe('rotateDaily', () => {
  it('takes each item in turn by day, for any whole day number', () => {
    const items = ['a', 'b', 'c'];
    expect([0, 1, 2, 3, 4].map((d) => rotateDaily(items, d))).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(rotateDaily(items, -1)).toBe('c');
    expect(rotateDaily([], 5)).toBeNull();
  });
});
