import {
  requestTutorTurn,
  SCENARIOS,
  START_MESSAGE,
  tutorOutputToJson,
  type ConversationTurn,
  type TutorContext,
} from '@italia/core';
import { createTestAbortController, tutorOutput } from '@italia/core/testing';

import { createLlamaConversationPartner, promptKey, type LlamaPartnerDeps } from './llamaPartner';
import type { BatteryState } from './power';
import { FakeLlamaRuntime, type FakeCompletion } from './testing';

const scenario = SCENARIOS.find((s) => s.id === 'bar-colazione');
if (!scenario) throw new Error('missing scenario');
const context: TutorContext = { learner: { level: 'A1' }, scenario };

const opening = tutorOutput('Buongiorno! Cosa prende?');
const recast = tutorOutput('Ecco un caffè!', {
  recast: { learnerText: 'un caffè caldo', correctedText: 'un caffè', errorTags: ['article-use'] },
  scenarioProgress: { goalsCompleted: ['order-drink'], done: false },
});

function setup(script: FakeCompletion[], overrides: Partial<LlamaPartnerDeps> = {}) {
  const runtime = new FakeLlamaRuntime(script);
  const battery: BatteryState = { level: 0.8, charging: false, lowPowerMode: false };
  const logs: string[] = [];
  const partner = createLlamaConversationPartner({
    runtime,
    platform: 'android',
    model: () => ({ id: 'gemma-4-e4b-it-q4_0', path: '/models/gemma.gguf' }),
    availability: () => Promise.resolve('needs_download'),
    stateDir: '/cache/tutor-state',
    battery: () => Promise.resolve(battery),
    log: (m) => logs.push(m),
    ...overrides,
  });
  return { runtime, partner, battery, logs };
}

async function drain(partner: ReturnType<typeof setup>['partner'], history: ConversationTurn[]) {
  const reply = partner.reply({ level: 'A1', scenario: 'bar', history, tutor: context });
  const pieces: string[] = [];
  for await (const piece of reply.tokens) pieces.push(piece);
  return { pieces, result: await reply.result };
}

describe('llama tutor partner', () => {
  it('renders the spec prompt, constrains output and streams only the reply text', async () => {
    const { runtime, partner } = setup([{ text: tutorOutputToJson(opening) }]);
    const { pieces, result } = await drain(partner, []);
    expect(pieces.join('')).toBe('Buongiorno! Cosa prende?');
    expect(pieces.length).toBeGreaterThan(1);
    expect(result).toMatchObject({ finishReason: 'complete', output: opening });
    const call = runtime.completions[0];
    expect(call?.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(call?.messages[1]?.content).toBe(START_MESSAGE);
    expect(call?.messages[0]?.content).toContain('Stay in role as the barista');
    const goals = (call?.jsonSchema.$defs as Record<string, Record<string, unknown>>)
      .ScenarioProgress;
    expect(JSON.stringify(goals)).toContain('order-drink');
  });

  it("logs each turn's raw output, so a missing correction can be traced on the device", async () => {
    const json = tutorOutputToJson(opening);
    const { partner, logs } = setup([{ text: json }]);
    await drain(partner, []);
    expect(logs).toContain(`raw output: ${json}`);
  });

  it('loads the model once with per-platform GPU settings and replays history as JSON', async () => {
    const { runtime, partner } = setup([
      { text: tutorOutputToJson(opening) },
      { text: tutorOutputToJson(recast) },
    ]);
    await drain(partner, []);
    const { result } = await drain(partner, [
      { role: 'partner', text: opening.reply, output: opening },
      { role: 'learner', text: 'Vorrei un caffè caldo.' },
    ]);
    expect(runtime.loads).toHaveLength(1);
    expect(runtime.loads[0]).toMatchObject({
      n_ctx: 4096,
      n_gpu_layers: 99,
      kv_unified: true,
      flash_attn_type: 'off',
      swa_full: true,
    });
    expect(runtime.completions[1]?.messages[2]).toEqual({
      role: 'assistant',
      content: tutorOutputToJson(opening),
    });
    expect(result.recast).toBe('un caffè');
    expect(result.errors).toEqual([
      { category: 'article-use', original: 'un caffè caldo', corrected: 'un caffè' },
    ]);
  });

  it('saves the opening prompt cache and restores it after a reload', async () => {
    const { runtime, partner } = setup([
      { text: tutorOutputToJson(opening) },
      { text: tutorOutputToJson(recast) },
    ]);
    await drain(partner, []);
    expect(runtime.saved).toHaveLength(1);
    expect(runtime.saved[0]?.tokens).toBe(300);
    expect(runtime.saved[0]?.path).toMatch(/^\/cache\/tutor-state\/[0-9a-f]{8}\.state$/);
    await partner.unload();
    expect(runtime.released).toBe(1);
    expect(partner.isLoaded()).toBe(false);
    await drain(partner, [
      { role: 'partner', text: opening.reply, output: opening },
      { role: 'learner', text: 'Vorrei un caffè caldo.' },
    ]);
    expect(runtime.loads).toHaveLength(2);
    expect(runtime.loadedStates).toEqual([runtime.saved[0]?.path]);
  });

  it('falls back to the CPU when the GPU load fails', async () => {
    const { runtime, partner, logs } = setup([{ text: tutorOutputToJson(opening) }]);
    runtime.failGpu = true;
    const { result } = await drain(partner, []);
    expect(result.finishReason).toBe('complete');
    expect(runtime.loads.map((l) => l.n_gpu_layers)).toEqual([99, 0]);
    expect(logs.some((l) => l.includes('CPU'))).toBe(true);
  });

  it('stops decoding on abort', async () => {
    const { runtime, partner } = setup([{ text: tutorOutputToJson(recast) }]);
    const controller = createTestAbortController();
    runtime.onPiece = (i) => {
      if (i === 4) controller.abort();
    };
    const reply = partner.reply(
      { level: 'A1', scenario: 'bar', history: [], tutor: context },
      { signal: controller.signal },
    );
    for await (const _ of reply.tokens) {
      // drain
    }
    const result = await reply.result;
    expect(result.finishReason).toBe('aborted');
    expect(runtime.stops).toBe(1);
  });

  it('reports a cut-off reply as length, and garbage as a failure', async () => {
    const cut = setup([{ text: '{"reply":"Buongiorno! Cosa', stoppedLimit: true }]);
    expect((await drain(cut.partner, [])).result).toMatchObject({
      finishReason: 'length',
      text: 'Buongiorno! Cosa',
    });
    const bad = setup([{ text: '{"reply":"x"}' }]);
    await expect(drain(bad.partner, [])).rejects.toThrow(/could not be read/);
  });

  it('refuses without a model, without a tutor context, on a flat battery or while busy', async () => {
    const none = setup([], { model: () => null });
    expect(await none.partner.availability()).toBe('needs_download');
    await expect(drain(none.partner, [])).rejects.toThrow(/not downloaded/);

    const { partner, battery } = setup([
      { text: tutorOutputToJson(opening) },
      { text: tutorOutputToJson(opening) },
    ]);
    expect(await partner.availability()).toBe('ready');
    await expect(
      partner.reply({ level: 'A1', scenario: 'bar', history: [] }).result,
    ).rejects.toThrow(/tutor context/);
    const first = partner.reply({ level: 'A1', scenario: 'bar', history: [], tutor: context });
    await expect(
      partner.reply({ level: 'A1', scenario: 'bar', history: [], tutor: context }).result,
    ).rejects.toThrow(/already answering/);
    for await (const _ of first.tokens) {
      // drain
    }
    await first.result;
    battery.level = 0.05;
    await expect(drain(partner, [])).rejects.toThrow(/battery is very low/);
    expect((await partner.powerAdvice()).mode).toBe('blocked');
  });

  it('shortens replies in power-saving mode', async () => {
    const { runtime, partner, battery } = setup([{ text: tutorOutputToJson(opening) }]);
    battery.lowPowerMode = true;
    await drain(partner, []);
    expect(runtime.completions[0]?.n_predict).toBe(320);
  });

  it('works with the conversation logic in core end to end', async () => {
    const { partner } = setup([{ text: tutorOutputToJson(recast) }]);
    const outcome = await requestTutorTurn(partner, context, {
      turns: [
        { role: 'tutor', text: opening.reply, output: opening },
        { role: 'learner', text: 'Vorrei un caffè caldo.' },
      ],
      goalsCompleted: [],
    });
    expect(outcome).toMatchObject({ kind: 'reply', dropped: [] });
  });

  it('names prompt caches by content', () => {
    expect(promptKey('a')).toMatch(/^[0-9a-f]{8}$/);
    expect(promptKey('a')).not.toBe(promptKey('b'));
  });
});
