import { getTableColumns, getTableName } from 'drizzle-orm';

import { RatingSchema } from '@italia/api-contract';
import { CARD_KINDS, CARD_STATES, RATINGS } from '@italia/core';

import { card, reviewLog } from './schema';

describe('database schema', () => {
  it('uses the same ratings as core and the sync contract', () => {
    expect(reviewLog.rating.enumValues).toEqual([...RATINGS]);
    expect(RatingSchema.options).toEqual([...RATINGS]);
  });

  it('stores every card kind and FSRS state defined in core', () => {
    expect(card.kind.enumValues).toEqual([...CARD_KINDS]);
    expect(card.state.enumValues).toEqual([...CARD_STATES]);
  });

  it('has a column for every CardSchedule field', () => {
    const columns = Object.keys(getTableColumns(card));
    expect(columns).toEqual(
      expect.arrayContaining([
        'due',
        'stability',
        'difficulty',
        'scheduledDays',
        'learningSteps',
        'reps',
        'lapses',
        'state',
        'lastReview',
      ]),
    );
  });

  it('names tables as in the plan', () => {
    expect(getTableName(reviewLog)).toBe('review_log');
  });
});
