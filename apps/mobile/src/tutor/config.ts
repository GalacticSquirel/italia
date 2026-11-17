/**
 * Runtime settings for the tutor model: context, GPU offload per platform,
 * sampling, and fitting a long dialogue into the context window.
 */
import type { TutorTurn } from '@italia/core';

import type { LlamaCompletionParams, LlamaInitParams } from './runtime';

/** Context window in tokens (training README: n_ctx 4096). */
export const CONTEXT_TOKENS = 4096;

/**
 * Most tokens per tutor turn. A reply is at most 5 short sentences plus
 * annotations; the schema caps the reply at 600 characters.
 */
export const MAX_REPLY_TOKENS = 512;

/** Fewer tokens per turn when saving power (still room for a short reply and annotations). */
export const SAVER_REPLY_TOKENS = 320;

/** Room kept free for the chat template's control tokens and rounding. */
const TEMPLATE_MARGIN_TOKENS = 128;

/**
 * Characters per token, conservatively low for Italian with Gemma's tokenizer
 * (it averages nearer 4), so estimates err towards trimming early.
 */
export const CHARS_PER_TOKEN = 3;

/** Token estimate for text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Platform the runtime runs on. */
export type RuntimePlatform = 'android' | 'ios';

/**
 * Model load parameters for a platform.
 *
 * - All layers on the GPU (Metal on iOS, OpenCL on Adreno 700+); llama.rn
 *   falls back to the CPU where the GPU is unsupported, and `gpu: false`
 *   loads on the CPU only (the retry after a GPU failure).
 * - `kv_unified` and `flash_attn_type: 'off'` on Android: OpenCL can only save
 *   and load sessions with them (llama.rn README).
 * - `swa_full`: Gemma 4 uses sliding-window attention; a full-size window
 *   cache lets the next turn reuse the cached prompt prefix instead of
 *   processing the whole dialogue again.
 */
export function contextParamsFor(
  platform: RuntimePlatform,
  modelPath: string,
  options: { gpu?: boolean; threads?: number } = {},
): LlamaInitParams {
  const gpu = options.gpu ?? true;
  return {
    model: modelPath,
    n_ctx: CONTEXT_TOKENS,
    n_batch: 512,
    n_ubatch: 512,
    ...(options.threads === undefined ? {} : { n_threads: options.threads }),
    n_gpu_layers: gpu ? 99 : 0,
    flash_attn_type: platform === 'android' ? 'off' : 'auto',
    kv_unified: true,
    swa_full: true,
    use_mmap: true,
    use_mlock: false,
    ctx_shift: false,
  };
}

/**
 * Sampling for tutor turns: Gemma 4's recommended top-k/top-p with a lower
 * temperature, since the tutor must stay in role and within its band.
 */
export function samplingFor(
  nPredict: number,
): Omit<LlamaCompletionParams, 'messages' | 'jsonSchema'> {
  return {
    n_predict: nPredict,
    temperature: 0.7,
    top_k: 64,
    top_p: 0.95,
    min_p: 0.05,
    penalty_repeat: 1.0,
  };
}

/**
 * Keep the dialogue within the context window: drop the oldest exchanges
 * (a tutor turn and the learner's answer) after the opening turn until the
 * estimate fits. The system prompt, the opening and the latest turns stay,
 * and turns keep alternating from the tutor.
 */
export function fitTurns(
  turns: readonly TutorTurn[],
  systemPrompt: string,
  replyTokens: number,
  turnText: (turn: TutorTurn) => string,
  contextTokens = CONTEXT_TOKENS,
): TutorTurn[] {
  const budget =
    contextTokens - replyTokens - TEMPLATE_MARGIN_TOKENS - estimateTokens(systemPrompt);
  const cost = (list: readonly TutorTurn[]) =>
    list.reduce((sum, t) => sum + estimateTokens(turnText(t)) + 4, 0);
  const kept = [...turns];
  // Index 0 is the opening tutor turn; drop pairs from index 1 (tutor's reply
  // to the learner's first answer comes at 2, so remove [1, 2]).
  while (cost(kept) > budget && kept.length > 3) {
    kept.splice(1, 2);
  }
  return kept;
}
