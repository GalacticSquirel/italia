import { initLlama } from 'llama.rn';

import { nativeLlamaRuntime } from './nativeLlama';
import type { LlamaCompletionParams } from './runtime';

type TokenCallback = (data: { token: string; content?: string }) => void;

const JSON_REPLY = '{"reply":"Ciao!"}';

/** What llama.rn streams for a Gemma 4 turn: an empty thought, then fenced JSON. */
const STREAM: { token: string; content?: string }[] = [
  { token: '<|channel>' },
  { token: 'thought' },
  { token: '<channel|>' },
  { token: '```json\n' },
  { token: '{"reply":"', content: '{"reply":"' },
  { token: 'Ciao!"}', content: JSON_REPLY },
  { token: '\n```', content: JSON_REPLY },
];

function fakeContext() {
  const calls: Record<string, unknown>[] = [];
  const context = {
    gpu: true,
    reasonNoGPU: '',
    completion: jest.fn((params: Record<string, unknown>, onToken: TokenCallback) => {
      calls.push(params);
      for (const data of STREAM) onToken(data);
      return Promise.resolve({
        text: `<|channel>thought<channel|>\`\`\`json\n${JSON_REPLY}\n\`\`\``,
        content: JSON_REPLY,
        stopped_limit: 0,
        interrupted: false,
        context_full: false,
        tokens_evaluated: 10,
        tokens_cached: 0,
        tokens_predicted: 12,
        timings: { predicted_per_second: 9, prompt_ms: 100 },
      });
    }),
  };
  return { context, calls };
}

const request: LlamaCompletionParams = {
  messages: [{ role: 'user', content: 'Ciao' }],
  jsonSchema: { type: 'object' },
  n_predict: 400,
  temperature: 0.7,
  top_k: 64,
  top_p: 0.95,
  min_p: 0,
  penalty_repeat: 1,
};

async function complete() {
  const { context, calls } = fakeContext();
  jest.mocked(initLlama).mockResolvedValue(context as never);
  const session = await nativeLlamaRuntime.load({} as never);
  const streamed: string[] = [];
  const result = await session.completion(request, (content) => streamed.push(content));
  return { params: calls[0] ?? {}, streamed, result };
}

describe('nativeLlamaRuntime completion', () => {
  it('closes the Gemma 4 thought block at once so the JSON is not starved', async () => {
    // With a response format, llama.cpp lets Gemma 4 think before the JSON, and
    // enable_thinking: false alone does not stop it (empty replies on phones).
    const { params } = await complete();
    expect(params).toMatchObject({
      jinja: true,
      enable_thinking: false,
      thinking_budget_tokens: 0,
      response_format: { type: 'json_schema', json_schema: { strict: true } },
    });
    // 'none' would leave the thought block in the content and break parsing.
    expect(params.reasoning_format).not.toBe('none');
  });

  it('streams and returns the parsed JSON content, not the raw tokens', async () => {
    const { streamed, result } = await complete();
    expect(streamed).toEqual(['{"reply":"', JSON_REPLY, JSON_REPLY]);
    expect(result.text).toBe(JSON_REPLY);
  });
});
