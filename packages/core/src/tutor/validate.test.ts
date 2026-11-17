import { describe, expect, it } from 'vitest';

import { tutorOutput } from '../testing';
import { SCENARIOS } from './spec.generated';
import type { TutorContext } from './types';
import {
  correctedSentence,
  learnerErrorsOf,
  normaliseItalian,
  postValidate,
  spanInMessage,
} from './validate';

const scenario = SCENARIOS.find((s) => s.id === 'biglietto-treno');
if (!scenario) throw new Error('missing scenario');
const context: TutorContext = { learner: { level: 'A2' }, scenario };
const learnerText = 'Ieri ho andato a Napoli.';

const recast = (learner: string, corrected: string, tags = ['auxiliary-choice']) =>
  tutorOutput('Ah, è andata a Napoli!', {
    recast: { learnerText: learner, correctedText: corrected, errorTags: tags },
  });

describe('postValidate', () => {
  it('keeps a good recast', () => {
    const r = postValidate(recast('ho andato', 'sono andata'), { context, learnerText });
    expect(r.dropped).toEqual([]);
    expect(r.output.annotations.recast?.correctedText).toBe('sono andata');
  });

  it('drops a recast that changes nothing (ignoring case and punctuation)', () => {
    const r = postValidate(recast('ho andato', 'Ho andato.'), { context, learnerText });
    expect(r.output.annotations.recast).toBeNull();
    expect(r.dropped[0]).toMatch(/same as the learner text/);
    expect(r.output.reply).toBe('Ah, è andata a Napoli!');
  });

  it('drops tags outside the taxonomy and keeps known ones', () => {
    const mixed = postValidate(
      recast('ho andato', 'sono andata', ['made-up', 'auxiliary-choice']),
      {
        context,
        learnerText,
      },
    );
    expect(mixed.output.annotations.recast?.errorTags).toEqual(['auxiliary-choice']);
    const none = postValidate(recast('ho andato', 'sono andata', ['made-up']), {
      context,
      learnerText,
    });
    expect(none.output.annotations.recast).toBeNull();
  });

  it('drops corrections of text the learner did not write', () => {
    const r = postValidate(recast('sono venuto', 'sono venuta'), { context, learnerText });
    expect(r.output.annotations.recast).toBeNull();
    expect(r.dropped[0]).toMatch(/not in the learner's message/);
  });

  it('drops corrections on the opening turn', () => {
    const r = postValidate(recast('ho andato', 'sono andata'), { context, learnerText: null });
    expect(r.output.annotations.recast).toBeNull();
  });

  it('drops implausible corrected text', () => {
    expect(
      postValidate(recast('ho andato', 'sono {andata}'), { context, learnerText }).output
        .annotations.recast,
    ).toBeNull();
    expect(
      postValidate(
        recast('ho andato', 'sono andata ieri sera con tutti i miei amici di scuola e il cane'),
        { context, learnerText },
      ).output.annotations.recast,
    ).toBeNull();
  });

  it('keeps only the recast when both moves are present', () => {
    const both = tutorOutput('x', {
      prompt: { learnerText: 'ho andato', errorTags: ['auxiliary-choice'] },
      recast: {
        learnerText: 'ho andato',
        correctedText: 'sono andata',
        errorTags: ['auxiliary-choice'],
      },
    });
    const r = postValidate(both, { context, learnerText });
    expect(r.output.annotations.prompt).toBeNull();
    expect(r.output.annotations.recast).not.toBeNull();
  });

  it('checks prompts like recasts', () => {
    const ok = tutorOutput('Ho andato?', {
      prompt: { learnerText: 'Ho Andato', errorTags: ['auxiliary-choice', 'auxiliary-choice'] },
    });
    expect(postValidate(ok, { context, learnerText }).output.annotations.prompt?.errorTags).toEqual(
      ['auxiliary-choice'],
    );
    const bad = tutorOutput('?', {
      prompt: { learnerText: 'xyz', errorTags: ['auxiliary-choice'] },
    });
    expect(postValidate(bad, { context, learnerText }).output.annotations.prompt).toBeNull();
  });

  it('limits new words to the band and removes repeats', () => {
    const words = tutorOutput('x', {
      newWords: [
        { lemma: 'binario', glossEn: 'platform' },
        { lemma: 'Binario', glossEn: 'platform' },
        { lemma: 'coincidenza', glossEn: 'connection' },
      ],
    });
    const r = postValidate(words, { context, learnerText });
    expect(r.output.annotations.newWords).toEqual([{ lemma: 'binario', glossEn: 'platform' }]);
    expect(r.dropped).toHaveLength(2);
  });

  it('keeps progress cumulative and in scenario order', () => {
    const progress = tutorOutput('x', {
      scenarioProgress: { goalsCompleted: ['platform', 'nope'], done: false },
    });
    const r = postValidate(progress, { context, learnerText, previousGoals: ['destination'] });
    expect(r.output.annotations.scenarioProgress.goalsCompleted).toEqual([
      'destination',
      'platform',
    ]);
  });
});

describe('helpers', () => {
  it('normalises Italian text', () => {
    expect(normaliseItalian('  L’Italia,  bella! ')).toBe("l'italia, bella");
  });

  it('builds the corrected sentence from the learner message', () => {
    const r = { learnerText: 'ho andato', correctedText: 'sono andata', errorTags: ['x'] };
    expect(correctedSentence(learnerText, r)).toBe('Ieri sono andata a Napoli.');
    expect(correctedSentence('Ho andato a Roma.', r)).toBe('Sono andata a Roma.');
    expect(correctedSentence('Something else', r)).toBeNull();
  });

  it('finds the span the way validation compares text', () => {
    const fix = (learner: string, corrected: string) => ({
      learnerText: learner,
      correctedText: corrected,
      errorTags: ['x'],
    });
    expect(correctedSentence('Ieri ho andato a Napoli.', fix('ho andato.', 'sono andata.'))).toBe(
      'Ieri sono andata a Napoli.',
    );
    expect(
      correctedSentence('Ho bevuto l’acqua fredda', fix("l'acqua fredda", "l'acqua fresca")),
    ).toBe("Ho bevuto l'acqua fresca");
    expect(correctedSentence('Ieri  ho   andato a Napoli', fix('ho andato', 'sono andata'))).toBe(
      'Ieri  sono andata a Napoli', // spaces outside the span are the learner's own
    );
    // Whole words only: "io" is not the "io" inside "Mio".
    expect(correctedSentence('Mio fratello e io andiamo', fix('io', 'noi'))).toBe(
      'Mio fratello e noi andiamo',
    );
    expect(correctedSentence('Vado dell’amico', fix("dell'", "dall'"))).toBe("Vado dall'amico");
    expect(spanInMessage('io', 'Mio fratello')).toBe(false);
    expect(spanInMessage('ho andato.', 'Ieri ho andato a Napoli')).toBe(true);
    expect(spanInMessage('a (b', 'a (b c')).toBe(true);
  });

  it('lists learner errors of a turn', () => {
    expect(learnerErrorsOf(recast('ho andato', 'sono andata'))).toEqual([
      { category: 'auxiliary-choice', original: 'ho andato', corrected: 'sono andata' },
    ]);
    expect(learnerErrorsOf(tutorOutput('x'))).toEqual([]);
  });
});
