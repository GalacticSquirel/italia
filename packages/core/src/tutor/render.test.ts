import { describe, expect, it } from 'vitest';

import {
  allowedGrammarSlugs,
  bandFor,
  renderMessages,
  renderSystemPrompt,
  substitute,
  tagsForLevel,
  tutorOutputToJson,
} from './render';
import { SCENARIOS, SPEC_VERSION } from './spec.generated';
import type { ChatMessage, TutorContext, TutorTurn } from './types';
import golden from '../../../../training/spec/generated/render_cases.v1.json';

interface GoldenCase {
  name: string;
  context: TutorContext;
  turns: TutorTurn[];
  messages: ChatMessage[];
}

const cases = golden.cases as unknown as GoldenCase[];
const scenario = (id: string) => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

describe('renderMessages matches the Python renderer', () => {
  it('uses the same spec version', () => {
    expect(golden.specVersion).toBe(SPEC_VERSION);
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(renderMessages(c.context, c.turns)).toEqual(c.messages);
  });

  it('serialises tutor turns exactly as the training targets', () => {
    for (const c of cases) {
      const tutorTurns = c.turns.filter((t) => t.role === 'tutor');
      const assistant = c.messages.filter((m) => m.role === 'assistant');
      expect(tutorTurns.map((t) => tutorOutputToJson(t.output))).toEqual(
        assistant.map((m) => m.content),
      );
    }
  });
});

describe('renderSystemPrompt', () => {
  const ctx = (level: TutorContext['learner']['level']): TutorContext => ({
    learner: { level },
    scenario: scenario('bar-colazione'),
  });

  it('controls the level', () => {
    const a1 = renderSystemPrompt(ctx('A1'));
    const a2 = renderSystemPrompt(ctx('A2'));
    expect(a1).toContain('500 most common');
    expect(a2).toContain('1000 most common');
    expect(a1).toContain('English word in brackets');
    expect(a2).not.toContain('English word in brackets');
    expect(a1).toContain('Lei (formal)');
    expect(a1).not.toContain('$');
  });

  it('lists only the level’s error tags', () => {
    const a1 = renderSystemPrompt(ctx('A1'));
    const a1Tags = tagsForLevel('A1').map((t) => t.id);
    expect(a1).toContain(`Error tags: ${a1Tags.join(', ')}`);
    expect(tagsForLevel('B2').length).toBeGreaterThan(a1Tags.length);
  });

  it('rejects unknown grammar and error tags', () => {
    expect(() =>
      allowedGrammarSlugs({ ...ctx('A1'), learner: { level: 'A1', knownGrammar: ['nope'] } }),
    ).toThrow(/unknown grammar/);
    expect(() =>
      renderSystemPrompt({
        ...ctx('A1'),
        learner: { level: 'A1', errorHistory: [{ tag: 'nope', count: 2 }] },
      }),
    ).toThrow(/unknown error tag/);
  });

  it('applies a lemma ceiling', () => {
    expect(bandFor('A2', 750).lemmaCeiling).toBe(750);
    expect(bandFor('A2').lemmaCeiling).toBe(1000);
    expect(() => bandFor('A2', 0)).toThrow();
  });
});

describe('substitute', () => {
  it('follows Python string.Template', () => {
    expect(substitute('a $x ${y}z $$ b', { x: '1', y: '2' })).toBe('a 1 2z $ b');
    expect(() => substitute('$missing', {})).toThrow(/missing/);
    expect(() => substitute('cost $ 5', {})).toThrow(/invalid/);
  });
});

describe('renderMessages', () => {
  it('requires alternating turns starting with the tutor', () => {
    expect(() =>
      renderMessages({ learner: { level: 'A1' }, scenario: scenario('bar-colazione') }, [
        { role: 'learner', text: 'Ciao' },
      ]),
    ).toThrow(/alternate/);
  });
});
