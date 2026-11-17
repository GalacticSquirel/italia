import { describe, expect, it } from 'vitest';

import { gradeSpoken, type SpeechToText, type StoryGenerator } from '../index';
import {
  createFakeConversationPartner,
  createFakeGlosser,
  createFakePronunciationScorer,
  createFakeSpeechToText,
  createFakeStoryGenerator,
  createFakeTextToSpeech,
  createTestAbortController,
} from './index';

const audio = { kind: 'file', uri: 'file:///answer.m4a' } as const;

async function collect(tokens: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const token of tokens) out.push(token);
  return out;
}

describe('fake providers', () => {
  it('report availability', async () => {
    expect(await createFakeGlosser().availability()).toBe('ready');
    expect(await createFakeTextToSpeech({ availability: 'needs_download' }).availability()).toBe(
      'needs_download',
    );
  });

  it('stream a conversation reply token by token', async () => {
    const partner = createFakeConversationPartner({
      replies: [{ text: 'Ciao, come va?', recast: 'Sono andato', errors: [] }],
    });
    const reply = partner.reply({ level: 'A1', scenario: 'bar', history: [] });
    expect(await collect(reply.tokens)).toEqual(['Ciao,', ' come', ' va?']);
    expect(await reply.result).toEqual({
      text: 'Ciao, come va?',
      recast: 'Sono andato',
      errors: [],
      finishReason: 'complete',
    });
    expect(partner.requests).toHaveLength(1);
  });

  it('stop a conversation reply on abort', async () => {
    const partner = createFakeConversationPartner({ replies: [{ text: 'uno due tre quattro' }] });
    const controller = createTestAbortController();
    const reply = partner.reply(
      { level: 'A1', scenario: 'bar', history: [] },
      { signal: controller.signal },
    );
    const tokens: string[] = [];
    for await (const token of reply.tokens) {
      tokens.push(token);
      if (tokens.length === 2) controller.abort();
    }
    const result = await reply.result;
    expect(result.finishReason).toBe('aborted');
    expect(tokens.length).toBeLessThan(4);
    expect(result.text).toBe(tokens.join(''));
  });

  it('reject promise calls when already aborted', async () => {
    const controller = createTestAbortController();
    controller.abort();
    const call = { signal: controller.signal };
    const generator: StoryGenerator = createFakeStoryGenerator();
    const request = {
      level: 'A1',
      knownLemmas: [],
      targetLemmas: [],
      allowedGrammar: [],
      lengthWords: 100,
    } as const;
    await expect(generator.generate(request, call)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(createFakeTextToSpeech().voices(call)).rejects.toThrow();
    await expect(createFakeSpeechToText().transcribe(audio, call)).rejects.toThrow();
  });

  it('gloss known words and reject unknown ones', async () => {
    const glosser = createFakeGlosser({
      dictionary: { casa: { lemma: 'casa', partOfSpeech: 'NOUN', translation: 'house' } },
    });
    expect((await glosser.gloss({ word: 'Casa', sentence: 'La casa è grande.' })).lemma).toBe(
      'casa',
    );
    await expect(glosser.gloss({ word: 'xyz', sentence: '' })).rejects.toThrow();
  });

  it('drive spoken grading end to end with the pronunciation score kept separate', async () => {
    const stt: SpeechToText = createFakeSpeechToText({ transcripts: ['il ragazo'] });
    const scorer = createFakePronunciationScorer({ overall: 0.3 });
    const transcript = await stt.transcribe(audio);
    const score = await scorer.score({ audio, expectedText: 'il ragazzo' });
    expect(score.words.map((w) => w.word)).toEqual(['il', 'ragazzo']);
    const graded = gradeSpoken({
      transcript: transcript.text,
      accepted: ['il ragazzo'],
      kind: 'spoken_prompt',
      latencyMs: 10_000,
      pronunciationScore: score.overall,
    });
    expect(graded.rating).toBe('hard');
    expect(graded.pronunciationScore).toBe(0.3);
  });

  it('synthesise speech with word timings', async () => {
    const speech = await createFakeTextToSpeech().synthesise({ text: 'buona sera' });
    expect(speech.wordTimings).toEqual([
      { text: 'buona', startMs: 0, endMs: 300 },
      { text: 'sera', startMs: 300, endMs: 600 },
    ]);
  });
});
