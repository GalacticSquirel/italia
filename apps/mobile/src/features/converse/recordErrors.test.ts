import { createScheduler, GRAMMAR_POINT_BY_SLUG } from '@italia/core';
import { tutorOutput } from '@italia/core/testing';

import { cardIdFor } from '@/data';
import { getContentIndex } from '@/features/study/content';
import { buildCurriculum } from '@/features/study/curriculum';
import { resolvePrompt } from '@/features/study/prompts';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { grammarIdsForTags, recordTutorTurn } from './recordErrors';

let app: TestApp;
const scheduler = createScheduler();
const now = new Date('2026-11-01T10:00:00Z');

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

const recast = tutorOutput('Ah, sei andata a Napoli! Ti è piaciuta?', {
  recast: {
    learnerText: 'ho andato',
    correctedText: 'sono andata',
    errorTags: ['auxiliary-choice', 'participle-agreement'],
  },
});

describe('recordTutorTurn', () => {
  it('turns a recast into error records and a sentence production card', () => {
    const recorded = recordTutorTurn(app.repos, {
      learnerMessage: 'Ieri ho andato a Napoli.',
      output: recast,
      scheduler,
      now,
    });
    expect(recorded.card).not.toBeNull();
    const card = recorded.card;
    if (!card) return;
    expect(card.kind).toBe('sentence_production');
    expect(card.targetId).toBeLessThan(0);
    expect(card.state).toBe('new');
    const sentence = app.repos.learnerSentences.getById(card.targetId);
    expect(sentence).toMatchObject({
      it: 'Ieri sono andata a Napoli.',
      original: 'Ieri ho andato a Napoli.',
      errorTags: ['auxiliary-choice', 'participle-agreement'],
      source: 'conversation',
    });
    expect(recorded.errors.map((e) => [e.category, e.example, e.cardId])).toEqual([
      ['auxiliary-choice', 'ho andato', card.id],
      ['participle-agreement', 'ho andato', card.id],
    ]);
    expect(app.repos.errors.countByCategory()).toEqual(
      expect.arrayContaining([
        { category: 'auxiliary-choice', count: 1 },
        { category: 'participle-agreement', count: 1 },
      ]),
    );
  });

  it('makes a card the study session can show and offers it as a new item', () => {
    const { card } = recordTutorTurn(app.repos, {
      learnerMessage: 'Ieri ho andato a Napoli.',
      output: recast,
      scheduler,
      now,
    });
    if (!card) throw new Error('expected a card');
    const content = getContentIndex(app.repos);
    const prompt = resolvePrompt({ ...card }, content);
    expect(prompt).toMatchObject({
      kind: 'sentence_production',
      accepted: ['Ieri sono andata a Napoli.'],
      correction: { original: 'Ieri ho andato a Napoli.' },
    });
    const curriculum = buildCurriculum(content, app.repos.cards.listAll(), {
      words: 0,
      practice: 0,
      corrections: 3,
    });
    expect(curriculum.candidates[0]?.id).toBe(
      cardIdFor('sentence_production', card.targetId, 'typed'),
    );
  });

  it('records a prompt as errors without a card', () => {
    const recorded = recordTutorTurn(app.repos, {
      learnerMessage: 'Io avere fame.',
      output: tutorOutput('Come? Io … fame?', {
        prompt: { learnerText: 'avere', errorTags: ['verb-form'] },
      }),
      scheduler,
      now,
    });
    expect(recorded.card).toBeNull();
    expect(recorded.errors.map((e) => [e.category, e.example, e.cardId])).toEqual([
      ['verb-form', 'avere', null],
    ]);
    expect(app.repos.learnerSentences.listAll()).toEqual([]);
  });

  it('records nothing for a turn without corrections', () => {
    const recorded = recordTutorTurn(app.repos, {
      learnerMessage: 'Un cappuccino, per favore.',
      output: tutorOutput('Subito!'),
      scheduler,
      now,
    });
    expect(recorded).toEqual({ errors: [], card: null });
  });

  it('maps tags to content grammar point ids', () => {
    const tags = ['auxiliary-choice'];
    const expected = ['passato-prossimo-essere']
      .map((slug) => GRAMMAR_POINT_BY_SLUG.get(slug)?.id)
      .filter((id): id is number => typeof id === 'number');
    expect(expected).toEqual([23]);
    const ids = grammarIdsForTags(tags);
    for (const id of expected) expect(ids).toContain(id);
    expect(grammarIdsForTags(['not-a-tag'])).toEqual([]);
  });
});
