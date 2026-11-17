import { FEEDBACK_KEYS } from '@italia/speech';

import { feedbackText, isActionable, issueKind } from './feedbackText';

describe('feedbackText', () => {
  it('phrases every key the checks can emit, with its parameters', () => {
    for (const key of FEEDBACK_KEYS) {
      const text = feedbackText({
        key,
        params: { word: 'fatto', letters: 'tt', phoneme: 't', expected: 'fat', heard: 'to' },
      });
      expect(text).toMatch(/[.]$/);
      expect(text).toContain('fatto');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('speech.');
    }
  });

  it('reads well for the main errors', () => {
    expect(
      feedbackText({
        key: 'speech.geminate.soundedSingle',
        params: { word: 'palla', letters: 'll', phoneme: 'l' },
      }),
    ).toBe(
      'Hold the double “ll” in “palla” longer: pause on it briefly, as in “fatto”, not “fato”.',
    );
    expect(
      feedbackText({
        key: 'speech.stress.wrongSyllable',
        params: { word: 'ancora', expected: 'co', heard: 'an' },
      }),
    ).toBe('In “ancora”, stress “co”, not “an”.');
    expect(feedbackText({ key: 'speech.vowel.finalDropped', params: { word: 'pane' } })).toBe(
      'Do not drop the final vowel of “pane”.',
    );
  });

  it('falls back to the phoneme when letters are missing', () => {
    expect(
      feedbackText({ key: 'speech.consonant.aspirated', params: { word: 'pasta', phoneme: 'p' } }),
    ).toBe('Say the “p” in “pasta” without a puff of air.');
  });

  it('classifies keys', () => {
    expect(isActionable('speech.geminate.ok')).toBe(false);
    expect(isActionable('speech.stress.notApplicable')).toBe(false);
    expect(isActionable('speech.vowel.reduced')).toBe(true);
    expect(issueKind('speech.geminate.missing')).toBe('double_consonant');
    expect(issueKind('speech.stress.unclear')).toBe('stress');
    expect(issueKind('speech.vowel.diphthongised')).toBe('vowel_quality');
    expect(issueKind('speech.consonant.aspirated')).toBe('other');
  });
});
