/**
 * {@link LlamaRuntime} on llama.rn (llama.cpp): Metal on iOS, OpenCL on
 * Adreno GPUs and CPU elsewhere on Android. The only module that imports
 * llama.rn.
 */
import { initLlama, type LlamaContext } from 'llama.rn';

import type { LlamaCompletionResult, LlamaInitParams, LlamaRuntime, LlamaSession } from './runtime';

/**
 * Chat formatting for Gemma 4. With a response format, llama.cpp's Gemma 4
 * grammar also allows a `<|channel>thought` block before the JSON, and
 * `enable_thinking: false` does not stop the model opening one: it then thinks
 * until the token limit and the reply comes back empty. A zero thinking budget
 * closes the block as soon as it opens (llama-server's `--reasoning-budget 0`),
 * and `reasoning_format: 'auto'` keeps that empty block out of the content, so
 * the content is just the JSON (the grammar's json code fence is not content
 * either).
 */
const TUTOR_CHAT_FORMAT = {
  jinja: true,
  enable_thinking: false,
  thinking_budget_tokens: 0,
  reasoning_format: 'auto',
} as const;

function session(context: LlamaContext): LlamaSession {
  return {
    gpu: context.gpu,
    reasonNoGpu: context.reasonNoGPU,
    async completion(params, onContent): Promise<LlamaCompletionResult> {
      const result = await context.completion(
        {
          messages: params.messages,
          response_format: {
            type: 'json_schema',
            json_schema: { strict: true, schema: params.jsonSchema },
          },
          ...TUTOR_CHAT_FORMAT,
          n_predict: params.n_predict,
          temperature: params.temperature,
          top_k: params.top_k,
          top_p: params.top_p,
          min_p: params.min_p,
          penalty_repeat: params.penalty_repeat,
          ...(params.seed === undefined ? {} : { seed: params.seed }),
        },
        // Stream the parsed content, not raw tokens: the raw text also holds
        // the thought block and the code fence around the JSON.
        (data) => {
          if (data.content) onContent(data.content);
        },
      );
      return {
        text: result.content,
        stoppedLimit: result.stopped_limit > 0,
        interrupted: result.interrupted,
        contextFull: result.context_full,
        promptTokens: result.tokens_evaluated,
        cachedTokens: result.tokens_cached,
        predictedTokens: result.tokens_predicted,
        tokensPerSecond: result.timings.predicted_per_second,
        promptMs: result.timings.prompt_ms,
      };
    },
    // llama.rn types stopCompletion() as a promise, but its JSI function only
    // flags the running completion and returns undefined; wrap it so callers
    // get the promise the interface promises.
    async stop() {
      await context.stopCompletion();
    },
    async saveState(path, tokens) {
      await context.saveSession(path, { tokenSize: tokens });
    },
    async loadState(path) {
      const loaded = await context.loadSession(path);
      return loaded.tokens_loaded;
    },
    release: () => context.release(),
  };
}

/** The llama.rn runtime. */
export const nativeLlamaRuntime: LlamaRuntime = {
  async load(params: LlamaInitParams, onProgress) {
    // llama.rn reports load progress from 0 to 100.
    const context = await initLlama(
      params,
      onProgress
        ? (progress) => {
            onProgress(progress / 100);
          }
        : undefined,
    );
    return session(context);
  },
};
