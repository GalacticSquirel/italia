/**
 * {@link LlamaRuntime} on llama.rn (llama.cpp): Metal on iOS, OpenCL on
 * Adreno GPUs and CPU elsewhere on Android. The only module that imports
 * llama.rn.
 */
import { initLlama, type LlamaContext } from 'llama.rn';

import type { LlamaCompletionResult, LlamaInitParams, LlamaRuntime, LlamaSession } from './runtime';

/**
 * Chat template options for the tutor prompt. Thinking is off, so the
 * generation prompt ends with the model's turn and the model writes its
 * answer straight away.
 */
const TUTOR_TEMPLATE = { jinja: true, enable_thinking: false } as const;

/**
 * Each turn renders the messages with the model's chat template, then decodes
 * from that prompt under a plain grammar built from the JSON schema, so the
 * first token is the JSON's `{`. The output is exactly what the tutor model
 * was trained to write after its turn opens.
 *
 * The prompt is rendered separately because passing the messages with a
 * response format selects llama.cpp's Gemma 4 chat grammar instead. That
 * grammar lets the model open a `<|channel>thought` block before the JSON
 * and wraps the JSON in a code fence. A zero thinking budget does not close
 * every such block, because the budget only spots the tag's usual tokens.
 * The model then thinks until the token limit and the reply comes back
 * empty, or it writes the JSON inside the thought.
 */
function session(context: LlamaContext): LlamaSession {
  return {
    gpu: context.gpu,
    reasonNoGpu: context.reasonNoGPU,
    async completion(params, onContent): Promise<LlamaCompletionResult> {
      const chat = await context.getFormattedChat(params.messages, null, TUTOR_TEMPLATE);
      let text = '';
      const result = await context.completion(
        {
          prompt: chat.prompt,
          response_format: {
            type: 'json_schema',
            json_schema: { strict: true, schema: params.jsonSchema },
          },
          n_predict: params.n_predict,
          temperature: params.temperature,
          top_k: params.top_k,
          top_p: params.top_p,
          min_p: params.min_p,
          penalty_repeat: params.penalty_repeat,
          ...(params.seed === undefined ? {} : { seed: params.seed }),
        },
        (data) => {
          text += data.token;
          onContent(text);
        },
      );
      return {
        text: result.text || text,
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
