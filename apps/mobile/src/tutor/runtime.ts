/**
 * The slice of an on-device LLM runtime the tutor needs. `nativeLlama.ts`
 * implements it with llama.rn; tests use the fake in `tutor/testing.ts`, so
 * the native module is mocked at this boundary.
 */
import type { ChatMessage } from '@italia/core';

/** Context (model load) parameters, a subset of llama.rn's. */
export interface LlamaInitParams {
  /** Filesystem path of the GGUF (no `file://`). */
  model: string;
  n_ctx: number;
  n_batch: number;
  n_ubatch: number;
  n_threads?: number;
  /** Layers to offload to the GPU (Metal on iOS, OpenCL on Adreno); 0 for CPU only. */
  n_gpu_layers: number;
  flash_attn_type: 'auto' | 'on' | 'off';
  /** One KV buffer for all sequences; needed for session save with OpenCL. */
  kv_unified: boolean;
  /** Full-size sliding-window cache, so the prompt prefix can be reused across turns. */
  swa_full: boolean;
  use_mmap: boolean;
  use_mlock: boolean;
  /** Drop old tokens when the context fills; off, because `fitTurns` keeps the dialogue within it. */
  ctx_shift: boolean;
}

/** Sampling and output constraints for one completion. */
export interface LlamaCompletionParams {
  messages: ChatMessage[];
  /** JSON Schema enforced as a grammar while decoding. */
  jsonSchema: Record<string, unknown>;
  n_predict: number;
  temperature: number;
  top_k: number;
  top_p: number;
  min_p: number;
  penalty_repeat: number;
  seed?: number;
}

/** How a completion ended. */
export interface LlamaCompletionResult {
  /** The generated content (JSON for the tutor), without thinking or code fence. */
  text: string;
  /** Stopped by the token limit. */
  stoppedLimit: boolean;
  /** Stopped by `stop()`. */
  interrupted: boolean;
  contextFull: boolean;
  /** Prompt tokens processed now and reused from the cache. */
  promptTokens: number;
  cachedTokens: number;
  predictedTokens: number;
  /** Decode speed, tokens per second (0 when unknown). */
  tokensPerSecond: number;
  /** Prompt processing time in milliseconds. */
  promptMs: number;
}

/** A loaded model. */
export interface LlamaSession {
  /** Whether any layer runs on the GPU, and why not when it does not. */
  readonly gpu: boolean;
  readonly reasonNoGpu: string;
  /**
   * Run one completion. `onContent` gets the content decoded so far each time
   * it grows: the model's answer without any thinking or code fence around it.
   */
  completion(
    params: LlamaCompletionParams,
    onContent: (content: string) => void,
  ): Promise<LlamaCompletionResult>;
  /** Stop the running completion (it then resolves with `interrupted`). */
  stop(): Promise<void>;
  /** Save the first `tokens` tokens of the KV cache to a file. */
  saveState(path: string, tokens: number): Promise<void>;
  /** Restore a saved KV cache; resolves with the number of tokens loaded. */
  loadState(path: string): Promise<number>;
  /** Free the model and its memory. */
  release(): Promise<void>;
}

/** Loads models. */
export interface LlamaRuntime {
  load(params: LlamaInitParams, onProgress?: (fraction: number) => void): Promise<LlamaSession>;
}
