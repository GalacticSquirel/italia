/**
 * The on-device tutor: a {@link ConversationPartner} that runs the tutor
 * model (base Gemma 4 instruct now, our fine-tune later) through a
 * {@link LlamaRuntime}.
 *
 * Each turn renders the spec's system prompt and the dialogue (tutor turns as
 * their JSON), decodes under the output schema as a grammar so the reply
 * always parses, streams the `reply` text as it is decoded, and parses the
 * whole turn at the end. The model stays loaded between turns, so llama.cpp
 * reuses the cached prompt prefix; the system prompt's cache is also saved to
 * a file, so the first turn after a reload (for example after the app was in
 * the background) does not process it again.
 */
import {
  type CallOptions,
  type ConversationPartner,
  type ConversationReply,
  type ConversationReplyResult,
  type ConversationRequest,
  fnv1a32Hex,
  fromConversationHistory,
  learnerErrorsOf,
  parseTutorOutput,
  partialReply,
  type ProviderAvailability,
  renderMessages,
  renderSystemPrompt,
  runtimeOutputSchema,
  tutorOutputToJson,
} from '@italia/core';

import {
  contextParamsFor,
  fitTurns,
  MAX_REPLY_TOKENS,
  samplingFor,
  SAVER_REPLY_TOKENS,
  type RuntimePlatform,
} from './config';
import { powerAdvice, type BatteryState, type PowerAdvice } from './power';
import type { LlamaRuntime, LlamaSession } from './runtime';

/** The model file to load. */
export interface TutorModelFile {
  id: string;
  /** Filesystem path of the GGUF. */
  path: string;
}

/** Dependencies of {@link createLlamaConversationPartner}. */
export interface LlamaPartnerDeps {
  runtime: LlamaRuntime;
  platform: RuntimePlatform;
  /** The installed model to use, or null when there is none. */
  model(): TutorModelFile | null;
  /** Availability when no model is installed (from the model manager). */
  availability(): Promise<ProviderAvailability>;
  /** Folder (filesystem path) for saved prompt caches. */
  stateDir: string;
  battery(): Promise<BatteryState>;
  /** Diagnostics: GPU fallback, cache misses and each turn's raw output. */
  log?: (message: string) => void;
}

/** The tutor partner, with lifecycle controls for the app. */
export interface TutorPartner extends ConversationPartner {
  /** Free the model (on background, memory warnings, or leaving the conversation). */
  unload(): Promise<void>;
  /** Battery and heat advice for the next reply. */
  powerAdvice(): Promise<PowerAdvice>;
  /** Whether a model is in memory. */
  isLoaded(): boolean;
}

/** 32-bit FNV-1a as hex, to name prompt-cache files. */
export const promptKey = (text: string): string => fnv1a32Hex(text);

/** A single-consumer async queue of strings. */
function channel() {
  const items: string[] = [];
  let closed = false;
  let wake: (() => void) | null = null;
  const notify = () => {
    const w = wake;
    wake = null;
    w?.();
  };
  return {
    push(item: string) {
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *iterate(): AsyncGenerator<string> {
      for (;;) {
        const next = items.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}

/** Create the on-device tutor partner. */
export function createLlamaConversationPartner(deps: LlamaPartnerDeps): TutorPartner {
  let loaded: { id: string; session: LlamaSession } | null = null;
  let loading: Promise<{ id: string; session: LlamaSession }> | null = null;
  let busy = false;
  /** Prompt caches restored into, or saved from, the loaded context. */
  let warmKeys = new Set<string>();
  /** Decode speeds of this conversation's turns, for heat detection. */
  const speeds: number[] = [];
  const log = deps.log ?? (() => undefined);

  async function load(file: TutorModelFile): Promise<{ id: string; session: LlamaSession }> {
    let session: LlamaSession;
    try {
      session = await deps.runtime.load(contextParamsFor(deps.platform, file.path));
    } catch (e) {
      log(`GPU load failed, retrying on the CPU: ${e instanceof Error ? e.message : String(e)}`);
      session = await deps.runtime.load(contextParamsFor(deps.platform, file.path, { gpu: false }));
    }
    if (!session.gpu) log(`running on the CPU: ${session.reasonNoGpu}`);
    warmKeys = new Set();
    speeds.length = 0;
    return { id: file.id, session };
  }

  async function ensureLoaded(file: TutorModelFile): Promise<LlamaSession> {
    if (loaded?.id === file.id) return loaded.session;
    if (loaded) await unload();
    loading ??= load(file).finally(() => {
      loading = null;
    });
    loaded = await loading;
    return loaded.session;
  }

  async function unload(): Promise<void> {
    const current = loaded ?? (loading ? await loading.catch(() => null) : null);
    loaded = null;
    if (!current) return;
    if (busy) await current.session.stop().catch(() => undefined);
    await current.session.release();
  }

  async function advice(): Promise<PowerAdvice> {
    return powerAdvice(await deps.battery(), speeds);
  }

  async function generate(
    request: ConversationRequest,
    call: CallOptions,
    emit: (text: string) => void,
  ): Promise<ConversationReplyResult> {
    const context = request.tutor;
    if (!context) throw new Error('The tutor needs a tutor context for each request.');
    const aborted = (): ConversationReplyResult => ({
      text: '',
      recast: null,
      errors: [],
      finishReason: 'aborted',
    });
    const isAborted = () => call.signal?.aborted === true;
    if (isAborted()) return aborted();
    const file = deps.model();
    if (!file) throw new Error('The conversation model is not downloaded.');
    const power = await advice();
    if (power.mode === 'blocked') throw new Error(power.message ?? 'Battery too low.');

    const session = await ensureLoaded(file);
    if (isAborted()) return aborted();
    const systemPrompt = renderSystemPrompt(context);
    const replyTokens = power.mode === 'saver' ? SAVER_REPLY_TOKENS : MAX_REPLY_TOKENS;
    const turns = fitTurns(
      fromConversationHistory(request.history),
      systemPrompt,
      replyTokens,
      (t) => (t.role === 'tutor' ? tutorOutputToJson(t.output) : t.text),
    );
    const messages = renderMessages(context, turns, systemPrompt);
    const key = promptKey(`${file.id}\n${systemPrompt}`);
    const statePath = `${deps.stateDir}/${key}.state`;
    if (!warmKeys.has(key)) {
      try {
        const tokens = await session.loadState(statePath);
        log(`restored ${String(tokens)} cached prompt tokens`);
        warmKeys.add(key);
      } catch {
        // No saved cache for this prompt yet: it is saved after the opening turn.
      }
    }

    const onAbort = () => {
      void session.stop().catch(() => undefined);
    };
    call.signal?.addEventListener('abort', onAbort, { once: true });
    let content = '';
    let emitted = '';
    try {
      const result = await session.completion(
        {
          messages,
          jsonSchema: runtimeOutputSchema(context.scenario),
          ...samplingFor(replyTokens),
        },
        (sofar) => {
          content = sofar;
          const partial = partialReply(content);
          if (partial && partial.text.length > emitted.length) {
            emit(partial.text.slice(emitted.length));
            emitted = partial.text;
          }
        },
      );
      if (result.tokensPerSecond > 0) speeds.push(result.tokensPerSecond);
      if (result.interrupted || isAborted()) {
        return { ...aborted(), text: emitted };
      }
      if (turns.length === 0 && !warmKeys.has(key)) {
        // The opening prompt (system prompt and [inizio]) is the prefix of every later turn.
        await session
          .saveState(statePath, result.promptTokens + result.cachedTokens)
          .then(() => warmKeys.add(key))
          .catch((e: unknown) => {
            log(`could not save the prompt cache: ${String(e)}`);
          });
      }
      const raw = result.text || content;
      log(`raw output: ${raw}`);
      const parsed = parseTutorOutput(raw);
      if (!parsed.ok) {
        if (result.stoppedLimit || result.contextFull) {
          return { text: emitted, recast: null, errors: [], finishReason: 'length' };
        }
        throw new Error(`The tutor's reply could not be read (${parsed.error}).`);
      }
      const output = parsed.output;
      return {
        text: output.reply,
        recast: output.annotations.recast?.correctedText ?? null,
        errors: learnerErrorsOf(output),
        finishReason: 'complete',
        output,
      };
    } finally {
      call.signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    id: 'llama-tutor',
    async availability() {
      return deps.model() ? 'ready' : deps.availability();
    },
    reply(request, call: CallOptions = {}): ConversationReply {
      const queue = channel();
      const result = (async () => {
        if (busy) throw new Error('The tutor is already answering.');
        busy = true;
        try {
          return await generate(request, call, (text) => {
            queue.push(text);
          });
        } finally {
          busy = false;
          queue.close();
        }
      })();
      // The caller reads `tokens` first; keep an early failure from being unhandled meanwhile.
      result.catch(() => undefined);
      return { tokens: queue.iterate(), result };
    },
    unload,
    powerAdvice: advice,
    isLoaded: () => loaded !== null,
  };
}
