import { tutorOutputToJson, type TutorTurn } from '@italia/core';
import { tutorOutput } from '@italia/core/testing';

import type { ModelStatus, ModelView } from '@/models';
import { MANIFEST } from '@/models';

import { contextParamsFor, estimateTokens, fitTurns } from './config';
import { chooseTutorModel } from './modelChoice';
import { looksThrottled, powerAdvice } from './power';

describe('contextParamsFor', () => {
  it('offloads to the GPU with session-safe settings per platform', () => {
    expect(contextParamsFor('android', '/m.gguf')).toMatchObject({
      model: '/m.gguf',
      n_gpu_layers: 99,
      flash_attn_type: 'off',
      kv_unified: true,
    });
    expect(contextParamsFor('ios', '/m.gguf').flash_attn_type).toBe('auto');
    expect(contextParamsFor('android', '/m.gguf', { gpu: false }).n_gpu_layers).toBe(0);
  });
});

describe('fitTurns', () => {
  const tutor = (reply: string): TutorTurn => ({
    role: 'tutor',
    text: reply,
    output: tutorOutput(reply),
  });
  const text = (t: TutorTurn) => (t.role === 'tutor' ? tutorOutputToJson(t.output) : t.text);
  const long = 'parola '.repeat(60);
  const turns: TutorTurn[] = [tutor('Apertura')];
  for (let i = 0; i < 30; i += 1) {
    turns.push({ role: 'learner', text: `${String(i)} ${long}` });
    turns.push(tutor(`Risposta ${String(i)} ${long}`));
  }

  it('keeps short dialogues whole', () => {
    expect(fitTurns(turns.slice(0, 5), 'system', 512, text)).toHaveLength(5);
  });

  it('drops the oldest exchanges but keeps the opening and alternation', () => {
    const fitted = fitTurns(turns, 'system '.repeat(200), 512, text);
    expect(fitted.length).toBeLessThan(turns.length);
    expect(fitted[0]).toBe(turns[0]);
    expect(fitted.at(-1)).toBe(turns.at(-1));
    fitted.forEach((t, i) => {
      expect(t.role).toBe(i % 2 === 0 ? 'tutor' : 'learner');
    });
    const total = fitted.reduce((sum, t) => sum + estimateTokens(text(t)) + 4, 0);
    expect(total + estimateTokens('system '.repeat(200)) + 512 + 128).toBeLessThanOrEqual(4096);
  });
});

describe('power', () => {
  const battery = { level: 0.8, charging: false, lowPowerMode: false };

  it('detects throttling from falling decode speed', () => {
    expect(looksThrottled([12, 12, 11])).toBe(false);
    expect(looksThrottled([12, 13, 11, 6, 5])).toBe(true);
    expect(looksThrottled([12, 13, 11, 6, 12])).toBe(false);
  });

  it('advises by battery, power mode and heat', () => {
    expect(powerAdvice(battery, []).mode).toBe('normal');
    expect(powerAdvice({ ...battery, level: 0.05 }, []).mode).toBe('blocked');
    expect(powerAdvice({ ...battery, level: 0.05, charging: true }, []).mode).toBe('normal');
    expect(powerAdvice({ ...battery, level: 0.15 }, []).mode).toBe('saver');
    expect(powerAdvice({ ...battery, lowPowerMode: true }, []).mode).toBe('saver');
    expect(powerAdvice(battery, [12, 12, 5, 5]).message).toMatch(/warm/);
    expect(powerAdvice({ ...battery, level: null }, []).mode).toBe('normal');
  });
});

describe('chooseTutorModel', () => {
  const llms = MANIFEST.models.filter((m) => m.kind === 'llm');
  const views = (statuses: ModelStatus[]): ModelView[] =>
    llms.map((spec, i) => ({
      spec,
      status: statuses[i] ?? 'not_installed',
      bytesDone: 0,
      bytesTotal: 1,
      error: null,
    }));

  it('lists Gemma 4 E4B before E2B in the manifest', () => {
    expect(llms.map((m) => m.id)).toEqual(['gemma-4-e4b-it-q4_0', 'gemma-4-e2b-it-q4_0']);
    expect(llms[0]?.minRamBytes).toBeGreaterThan(llms[1]?.minRamBytes ?? Infinity);
  });

  it('uses an installed model the phone can run', () => {
    const choice = chooseTutorModel(views(['not_installed', 'installed']));
    expect(choice.state === 'ready' && choice.model.spec.id).toBe('gemma-4-e2b-it-q4_0');
  });

  it('recommends the largest model the phone can run', () => {
    const high = chooseTutorModel(views(['not_installed', 'not_installed']));
    expect(high.state === 'needs_download' && high.model.spec.id).toBe('gemma-4-e4b-it-q4_0');
    expect(high.state === 'needs_download' && high.sizeBytes).toBe(4_590_807_392);
    const mid = chooseTutorModel(views(['unsupported', 'not_installed']));
    expect(mid.state === 'needs_download' && mid.model.spec.id).toBe('gemma-4-e2b-it-q4_0');
  });

  it('continues a download already started', () => {
    const choice = chooseTutorModel(views(['not_installed', 'paused']));
    expect(choice.state === 'needs_download' && choice.model.status).toBe('paused');
  });

  it('is honest when the phone cannot run any model or none is published', () => {
    expect(chooseTutorModel(views(['unsupported', 'unsupported']))).toEqual({
      state: 'unsupported',
      minRamBytes: llms[1]?.minRamBytes,
    });
    expect(chooseTutorModel(views(['unavailable', 'unavailable'])).state).toBe('unavailable');
    expect(chooseTutorModel([]).state).toBe('unavailable');
  });
});
