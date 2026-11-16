/**
 * {@link LlamaRuntime} on llama.rn (llama.cpp): Metal on iOS, OpenCL on
 * Adreno GPUs and CPU elsewhere on Android. The only module that imports
 * llama.rn.
 */
import { initLlama, type LlamaContext } from 'llama.rn';

import type { LlamaCompletionResult, LlamaInitParams, LlamaRuntime, LlamaSession } from './runtime';

function session(context: LlamaContext): LlamaSession {
  return {
    gpu: context.gpu,
    reasonNoGpu: context.reasonNoGPU,
    async completion(params, onText): Promise<LlamaCompletionResult> {
      const result = await context.completion(
        {
          messages: params.messages,
          response_format: {
            type: 'json_schema',
            json_schema: { strict: true, schema: params.jsonSchema },
          },
          jinja: true,
          enable_thinking: false,
          reasoning_format: 'none',
          n_predict: params.n_predict,
          temperature: params.temperature,
          top_k: params.top_k,
          top_p: params.top_p,
          min_p: params.min_p,
          penalty_repeat: params.penalty_repeat,
          ...(params.seed === undefined ? {} : { seed: params.seed }),
        },
        (data) => {
          if (data.token) onText(data.token);
        },
      );
      return {
        text: result.content || result.text,
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
    stop: () => context.stopCompletion(),
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
