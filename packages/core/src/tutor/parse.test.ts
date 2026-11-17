import { describe, expect, it } from 'vitest';

import { parseTutorOutput, partialReply } from './parse';
import { tutorOutputToJson } from './render';
import type { TutorOutput } from './types';

const output: TutorOutput = {
  reply: 'Ho andato? È sicura?',
  annotations: {
    prompt: { learnerText: 'ho andato', errorTags: ['auxiliary-choice'] },
    recast: null,
    newWords: [{ lemma: 'binario', glossEn: 'platform' }],
    scenarioProgress: { goalsCompleted: ['destination'], done: false },
  },
};

describe('parseTutorOutput', () => {
  it('round-trips canonical JSON', () => {
    expect(parseTutorOutput(tutorOutputToJson(output))).toEqual({ ok: true, output });
  });

  it('trims strings and accepts whitespace between tokens', () => {
    const spaced = JSON.stringify({ ...output, reply: '  Ciao!  ' }, null, 2);
    const parsed = parseTutorOutput(spaced);
    expect(parsed.ok && parsed.output.reply).toBe('Ciao!');
  });

  it.each([
    ['not JSON', '{"reply": "Ciao'],
    ['empty reply', tutorOutputToJson({ ...output, reply: ' ' })],
    ['unknown key', JSON.stringify({ ...output, extra: 1 })],
    [
      'missing annotations key',
      JSON.stringify({ reply: 'x', annotations: { prompt: null, recast: null, newWords: [] } }),
    ],
    [
      'bad tag',
      tutorOutputToJson({
        ...output,
        annotations: {
          ...output.annotations,
          prompt: { learnerText: 'x', errorTags: ['Bad Tag'] },
        },
      }),
    ],
    [
      'no tags',
      tutorOutputToJson({
        ...output,
        annotations: { ...output.annotations, prompt: { learnerText: 'x', errorTags: [] } },
      }),
    ],
    [
      'too many new words',
      tutorOutputToJson({
        ...output,
        annotations: {
          ...output.annotations,
          newWords: Array.from({ length: 4 }, (_, i) => ({ lemma: `w${i}`, glossEn: 'w' })),
        },
      }),
    ],
    ['reply too long', tutorOutputToJson({ ...output, reply: 'a'.repeat(601) })],
    ['done not boolean', tutorOutputToJson(output).replace('"done":false', '"done":"no"')],
  ])('rejects %s', (_name, raw) => {
    expect(parseTutorOutput(raw).ok).toBe(false);
  });
});

describe('partialReply', () => {
  const full = tutorOutputToJson(output);

  it('is null before the reply string opens', () => {
    expect(partialReply('')).toBeNull();
    expect(partialReply('{"rep')).toBeNull();
    expect(partialReply('{"reply":')).toBeNull();
    expect(partialReply('{"annotations":')).toBeNull();
  });

  it('decodes every prefix to a prefix of the reply', () => {
    for (let n = 11; n <= full.length; n += 1) {
      const partial = partialReply(full.slice(0, n));
      expect(partial).not.toBeNull();
      expect(output.reply.startsWith(partial?.text ?? '?')).toBe(true);
    }
    expect(partialReply(full)).toEqual({ text: output.reply, complete: true });
  });

  it('decodes escapes and holds back cut-off ones', () => {
    expect(partialReply('{"reply":"Lui dice \\"ciao\\"')?.text).toBe('Lui dice "ciao"');
    expect(partialReply('{"reply":"a\\')?.text).toBe('a');
    expect(partialReply('{"reply":"caff\\u00e')?.text).toBe('caff');
    expect(partialReply('{"reply":"caff\\u00e8')?.text).toBe('caffè');
    expect(partialReply('{"reply":"x\\ud83d')?.text).toBe('x');
    expect(partialReply('{"reply":"x\\ud83d\\ude00"')).toEqual({ text: 'x😀', complete: true });
  });

  it('allows whitespace the grammar permits', () => {
    expect(partialReply(' {\n  "reply" : "Ciao')).toEqual({ text: 'Ciao', complete: false });
  });
});
