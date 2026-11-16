import { describe, expect, it } from 'vitest';

import { createFakeConversationPartner, createTestAbortController, tutorOutput } from '../testing';
import {
  canSend,
  conversationReducer,
  fromConversationHistory,
  INITIAL_CONVERSATION,
  MAX_LEARNER_TURNS,
  requestTutorTurn,
  summariseConversation,
  toConversationHistory,
  type ConversationEvent,
  type ConversationState,
} from './conversation';
import { SCENARIOS } from './spec.generated';
import type { TutorContext } from './types';

const scenario = SCENARIOS.find((s) => s.id === 'biglietto-treno');
if (!scenario) throw new Error('missing scenario');
const context: TutorContext = { learner: { level: 'A2' }, scenario };

const opening = tutorOutput('Buongiorno! Dove vuole andare?');
const prompted = tutorOutput('Ho andato? È sicura?', {
  prompt: { learnerText: 'ho andato', errorTags: ['auxiliary-choice'] },
  scenarioProgress: { goalsCompleted: ['destination'], done: false },
});
const recast = tutorOutput('Ah, è andata a Napoli! Andata e ritorno?', {
  recast: {
    learnerText: 'ho andato',
    correctedText: 'sono andata',
    errorTags: ['auxiliary-choice'],
  },
  newWords: [{ lemma: 'ritorno', glossEn: 'return' }],
  scenarioProgress: { goalsCompleted: ['destination'], done: false },
});
const finished = tutorOutput('Buon viaggio!', {
  scenarioProgress: { goalsCompleted: ['destination', 'type'], done: true },
});

const run = (events: ConversationEvent[], from = INITIAL_CONVERSATION) =>
  events.reduce(conversationReducer, from);

describe('conversationReducer', () => {
  it('runs a whole conversation', () => {
    let s = run([{ type: 'start' }, { type: 'token', text: 'Buon' }]);
    expect(s.phase).toBe('streaming');
    expect(s.streaming).toBe('Buon');
    s = run([{ type: 'reply', output: opening, dropped: [] }], s);
    expect(s.phase).toBe('learner_turn');
    expect(canSend(s)).toBe(true);
    s = run(
      [
        { type: 'learner', text: '  Ieri ho andato a Napoli. ' },
        { type: 'reply', output: prompted, dropped: [] },
        { type: 'learner', text: 'Sì, ho andato a Napoli.' },
        { type: 'reply', output: recast, dropped: ['newWords: x'] },
        { type: 'learner', text: 'Andata e ritorno.' },
        { type: 'reply', output: finished, dropped: [] },
      ],
      s,
    );
    expect(s.turns.map((t) => t.role)).toEqual([
      'tutor',
      'learner',
      'tutor',
      'learner',
      'tutor',
      'learner',
      'tutor',
    ]);
    expect(s.turns[1]?.text).toBe('Ieri ho andato a Napoli.');
    expect(s.goalsCompleted).toEqual(['destination', 'type']);
    expect(s.scenarioDone).toBe(true);
    expect(s.dropped[2]).toEqual(['newWords: x']);
    s = run([{ type: 'end' }], s);
    expect(s.phase).toBe('ended');
    expect(canSend(s)).toBe(false);
  });

  it('ignores events that do not fit the phase', () => {
    expect(run([{ type: 'learner', text: 'Ciao' }])).toBe(INITIAL_CONVERSATION);
    const thinking = run([{ type: 'start' }]);
    expect(run([{ type: 'learner', text: 'Ciao' }], thinking)).toBe(thinking);
    expect(run([{ type: 'retry' }], thinking)).toBe(thinking);
    const waiting = run([{ type: 'reply', output: opening, dropped: [] }], thinking);
    expect(run([{ type: 'learner', text: '   ' }], waiting)).toBe(waiting);
  });

  it('fails and retries', () => {
    let s = run([{ type: 'start' }, { type: 'failed', error: 'boom' }]);
    expect(s).toMatchObject({ phase: 'failed', error: 'boom' });
    s = run([{ type: 'retry' }], s);
    expect(s).toMatchObject({ phase: 'thinking', error: null });
  });

  it('gives the learner their message back when a reply is stopped', () => {
    const s = run([
      { type: 'start' },
      { type: 'reply', output: opening, dropped: [] },
      { type: 'learner', text: 'Vorrei un biglietto.' },
      { type: 'token', text: 'Per' },
      { type: 'aborted' },
    ]);
    expect(s.phase).toBe('learner_turn');
    expect(s.draft).toBe('Vorrei un biglietto.');
    expect(s.turns).toHaveLength(1);
    expect(run([{ type: 'start' }, { type: 'aborted' }]).phase).toBe('idle');
  });

  it('stops accepting messages at the turn limit', () => {
    let s: ConversationState = run([
      { type: 'start' },
      { type: 'reply', output: opening, dropped: [] },
    ]);
    for (let i = 0; i < MAX_LEARNER_TURNS; i += 1) {
      s = run(
        [
          { type: 'learner', text: 'Sì.' },
          { type: 'reply', output: opening, dropped: [] },
        ],
        s,
      );
    }
    expect(canSend(s)).toBe(false);
  });
});

describe('history conversion', () => {
  it('round-trips turns through provider history', () => {
    const turns = run([
      { type: 'start' },
      { type: 'reply', output: opening, dropped: [] },
      { type: 'learner', text: 'Ciao' },
    ]).turns;
    const history = toConversationHistory(turns);
    expect(history[0]).toMatchObject({ role: 'partner', output: opening });
    expect(fromConversationHistory(history)).toEqual(turns);
    expect(() => fromConversationHistory([{ role: 'partner', text: 'x' }])).toThrow();
  });
});

describe('requestTutorTurn', () => {
  const afterLearner = run([
    { type: 'start' },
    { type: 'reply', output: opening, dropped: [] },
    { type: 'learner', text: 'Ieri ho andato a Napoli.' },
  ]);

  it('streams the reply and returns the checked output', async () => {
    const partner = createFakeConversationPartner({ replies: [{ output: recast }] });
    const seen: string[] = [];
    const outcome = await requestTutorTurn(partner, context, afterLearner, {
      onText: (t) => seen.push(t),
    });
    expect(outcome.kind).toBe('reply');
    expect(seen.at(-1)).toBe(recast.reply);
    expect(seen.length).toBeGreaterThan(2);
    const request = partner.requests[0];
    expect(request?.tutor).toBe(context);
    expect(request?.history[0]?.output).toBe(opening);
  });

  it('drops invalid annotations from the model', async () => {
    const bogus = tutorOutput('Bene!', {
      recast: { learnerText: 'Napoli', correctedText: 'Napoli', errorTags: ['auxiliary-choice'] },
    });
    const partner = createFakeConversationPartner({ replies: [{ output: bogus }] });
    const outcome = await requestTutorTurn(partner, context, afterLearner);
    expect(outcome.kind === 'reply' && outcome.output.annotations.recast).toBeNull();
    expect(outcome.kind === 'reply' && outcome.dropped.length).toBe(1);
  });

  it('reports failures without throwing', async () => {
    const truncated = createFakeConversationPartner({
      replies: [{ text: 'Buon', truncated: true }],
    });
    expect(await requestTutorTurn(truncated, context, afterLearner)).toEqual({
      kind: 'failed',
      error: 'The reply was cut off before it finished.',
    });
    const broken = createFakeConversationPartner({
      replies: [{ text: 'x', fail: 'native crash' }],
    });
    expect(await requestTutorTurn(broken, context, afterLearner)).toEqual({
      kind: 'failed',
      error: 'native crash',
    });
    const plain = createFakeConversationPartner({ replies: [{ text: 'Ciao' }] });
    expect((await requestTutorTurn(plain, context, afterLearner)).kind).toBe('failed');
  });

  it('honours abort', async () => {
    const partner = createFakeConversationPartner({ replies: [{ output: recast }] });
    const controller = createTestAbortController();
    const outcome = await requestTutorTurn(partner, context, afterLearner, {
      signal: controller.signal,
      onText: () => {
        controller.abort();
      },
    });
    expect(outcome).toEqual({ kind: 'aborted' });
  });
});

describe('summariseConversation', () => {
  it('collects corrections, recasts, new words and error counts', () => {
    const s = run([
      { type: 'start' },
      { type: 'reply', output: opening, dropped: [] },
      { type: 'learner', text: 'Ieri ho andato a Napoli.' },
      { type: 'reply', output: prompted, dropped: [] },
      { type: 'learner', text: 'Sì, ho andato a Napoli.' },
      { type: 'reply', output: recast, dropped: [] },
    ]);
    const summary = summariseConversation(s, context);
    expect(summary.learnerTurns).toBe(2);
    expect(summary.goalsTotal).toBe(4);
    expect(summary.corrections.map((c) => c.kind)).toEqual(['prompt', 'recast']);
    expect(summary.recasts).toEqual([
      {
        learnerMessage: 'Sì, ho andato a Napoli.',
        learnerText: 'ho andato',
        correctedText: 'sono andata',
        errorTags: ['auxiliary-choice'],
      },
    ]);
    expect(summary.newWords).toEqual([{ lemma: 'ritorno', glossEn: 'return' }]);
    expect(summary.errorCounts).toEqual([{ tag: 'auxiliary-choice', count: 2 }]);
  });
});
