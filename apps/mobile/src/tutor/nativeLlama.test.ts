import { initLlama } from 'llama.rn';

import { nativeLlamaRuntime } from './nativeLlama';
import type { LlamaCompletionParams } from './runtime';

type TokenCallback = (data: { token: string; content?: string }) => void;

const PROMPT = '<|turn>user\nCiao<turn|>\n<|turn>model\n';
const JSON_REPLY = '{"reply":"Ciao!"}';
/** Under a plain JSON grammar the model writes the JSON and nothing else. */
const TOKENS = ['{"reply":"', 'Ciao', '!"}'];

function fakeContext() {
  const completions: Record<string, unknown>[] = [];
  const formats: unknown[][] = [];
  const context = {
    gpu: true,
    reasonNoGPU: '',
    getFormattedChat: jest.fn((...args: unknown[]) => {
      formats.push(args);
      return Promise.resolve({ type: 'jinja', prompt: PROMPT, chat_format: 30 });
    }),
    completion: jest.fn((params: Record<string, unknown>, onToken: TokenCallback) => {
      completions.push(params);
      for (const token of TOKENS) onToken({ token });
      return Promise.resolve({
        text: JSON_REPLY,
        content: JSON_REPLY,
        stopped_limit: 0,
        interrupted: false,
        context_full: false,
        tokens_evaluated: 10,
        tokens_cached: 0,
        tokens_predicted: 3,
        timings: { predicted_per_second: 9, prompt_ms: 100 },
      });
    }),
  };
  return { context, completions, formats };
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
  const { context, completions, formats } = fakeContext();
  jest.mocked(initLlama).mockResolvedValue(context as never);
  const session = await nativeLlamaRuntime.load({} as never);
  const streamed: string[] = [];
  const result = await session.completion(request, (content) => streamed.push(content));
  return { params: completions[0] ?? {}, format: formats[0] ?? [], streamed, result };
}

describe('nativeLlamaRuntime completion', () => {
  it('renders the prompt with the chat template, thinking off and no response format', async () => {
    const { format } = await complete();
    expect(format[0]).toEqual(request.messages);
    // A response format here would select llama.cpp's Gemma 4 chat grammar,
    // which allows a thought block before the JSON (empty replies on phones).
    expect(format[2]).toEqual({ jinja: true, enable_thinking: false });
  });

  it('decodes from the rendered prompt under a plain JSON-schema grammar', async () => {
    const { params } = await complete();
    expect(params).toMatchObject({
      prompt: PROMPT,
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: request.jsonSchema },
      },
    });
    expect(params).not.toHaveProperty('messages');
    expect(params).not.toHaveProperty('chat_format');
    expect(params).not.toHaveProperty('jinja');
  });

  it('streams the JSON decoded so far and returns the whole of it', async () => {
    const { streamed, result } = await complete();
    expect(streamed).toEqual(['{"reply":"', '{"reply":"Ciao', JSON_REPLY]);
    expect(result.text).toBe(JSON_REPLY);
  });
});
