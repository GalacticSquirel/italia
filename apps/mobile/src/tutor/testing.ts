/**
 * Test-only fakes for the tutor runtime. Never import from app code.
 */
import { createFakeConversationPartner, type ScriptedReply } from '@italia/core/testing';

import type { TutorPartner } from './llamaPartner';
import type { PowerAdvice } from './power';
import type {
  LlamaCompletionParams,
  LlamaCompletionResult,
  LlamaInitParams,
  LlamaRuntime,
  LlamaSession,
} from './runtime';

/** A fake tutor partner playing scripted turns. */
export function createFakeTutorPartner(
  replies: readonly ScriptedReply[],
  options: { advice?: PowerAdvice } = {},
): TutorPartner & ReturnType<typeof createFakeConversationPartner> & { unloads: number } {
  const base = createFakeConversationPartner({ replies });
  const fake = Object.assign(base, {
    unloads: 0,
    unload() {
      fake.unloads += 1;
      return Promise.resolve();
    },
    powerAdvice: () =>
      Promise.resolve(options.advice ?? { mode: 'normal' as const, message: null }),
    isLoaded: () => true,
  });
  return fake;
}

/** A scripted completion: raw model output, streamed in pieces. */
export interface FakeCompletion {
  text: string;
  stoppedLimit?: boolean;
  contextFull?: boolean;
  tokensPerSecond?: number;
  /** Reject instead. */
  error?: string;
}

/** A fake {@link LlamaRuntime} that records what it was asked. */
export class FakeLlamaRuntime implements LlamaRuntime {
  loads: LlamaInitParams[] = [];
  completions: LlamaCompletionParams[] = [];
  saved: { path: string; tokens: number }[] = [];
  /** Paths whose state can be loaded. */
  states = new Set<string>();
  loadedStates: string[] = [];
  released = 0;
  stops = 0;
  /** Fail loads with GPU offload (to test the CPU fallback). */
  failGpu = false;
  gpu = true;
  /** Called between streamed pieces (tests abort from here). */
  onPiece: ((index: number) => void) | null = null;
  private stopped = false;

  /** Whether `stop()` was called during the current completion. */
  isStopped(): boolean {
    return this.stopped;
  }

  constructor(public script: FakeCompletion[]) {}

  load(params: LlamaInitParams): Promise<LlamaSession> {
    this.loads.push(params);
    if (this.failGpu && params.n_gpu_layers > 0) return Promise.reject(new Error('no GPU'));
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the session closes over the runtime
    const runtime = this;
    const session: LlamaSession = {
      gpu: params.n_gpu_layers > 0 && runtime.gpu,
      reasonNoGpu: params.n_gpu_layers > 0 ? '' : 'CPU only',
      async completion(request, onText): Promise<LlamaCompletionResult> {
        runtime.completions.push(request);
        runtime.stopped = false;
        const next = runtime.script.shift() ?? { text: '' };
        if (next.error !== undefined) throw new Error(next.error);
        const pieces = next.text.match(/.{1,5}/gsu) ?? [];
        let text = '';
        for (const [i, piece] of pieces.entries()) {
          await Promise.resolve();
          runtime.onPiece?.(i);
          if (runtime.isStopped()) break;
          text += piece;
          onText(piece);
        }
        return {
          text,
          stoppedLimit: next.stoppedLimit ?? false,
          interrupted: runtime.stopped,
          contextFull: next.contextFull ?? false,
          promptTokens: 300,
          cachedTokens: 0,
          predictedTokens: Math.ceil(text.length / 4),
          tokensPerSecond: next.tokensPerSecond ?? 12,
          promptMs: 900,
        };
      },
      stop() {
        runtime.stops += 1;
        runtime.stopped = true;
        return Promise.resolve();
      },
      saveState(path, tokens) {
        runtime.saved.push({ path, tokens });
        runtime.states.add(path);
        return Promise.resolve();
      },
      loadState(path) {
        if (!runtime.states.has(path)) return Promise.reject(new Error('no state'));
        runtime.loadedStates.push(path);
        return Promise.resolve(300);
      },
      release() {
        runtime.released += 1;
        return Promise.resolve();
      },
    };
    return Promise.resolve(session);
  }
}
