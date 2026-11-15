/**
 * Parsing tutor output: the whole JSON object once decoding ends, and the
 * `reply` string while it is still streaming (so it can be shown and spoken
 * before the annotations are decoded).
 */
import type {
  NewWord,
  ScenarioProgress,
  TutorAnnotations,
  TutorOutput,
  TutorPrompt,
  TutorRecast,
} from './types';

/** Result of {@link parseTutorOutput}. */
export type ParseResult = { ok: true; output: TutorOutput } | { ok: false; error: string };

const TAG_RE = /^[a-z][a-z0-9-]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const MAX_REPLY = 600;

class ShapeError extends Error {}

type Obj = Record<string, unknown>;

function object(value: unknown, where: string, keys: readonly string[]): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShapeError(`${where} must be an object`);
  }
  const obj = value as Obj;
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key)) throw new ShapeError(`${where} has unknown key ${key}`);
  }
  for (const key of keys) {
    if (!(key in obj)) throw new ShapeError(`${where} is missing ${key}`);
  }
  return obj;
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ShapeError(`${where} must be a non-empty string`);
  }
  return value.trim();
}

function array(value: unknown, where: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value)) throw new ShapeError(`${where} must be an array`);
  if (value.length < min || value.length > max) {
    throw new ShapeError(`${where} must have ${min} to ${max} items`);
  }
  return value as unknown[];
}

function tags(value: unknown, where: string): string[] {
  return array(value, where, 1, 2).map((t, i) => {
    if (typeof t !== 'string' || !TAG_RE.test(t)) throw new ShapeError(`${where}[${i}] is invalid`);
    return t;
  });
}

function prompt(value: unknown): TutorPrompt | null {
  if (value === null) return null;
  const o = object(value, 'prompt', ['learnerText', 'errorTags']);
  return {
    learnerText: text(o.learnerText, 'prompt.learnerText'),
    errorTags: tags(o.errorTags, 'prompt.errorTags'),
  };
}

function recast(value: unknown): TutorRecast | null {
  if (value === null) return null;
  const o = object(value, 'recast', ['learnerText', 'correctedText', 'errorTags']);
  return {
    learnerText: text(o.learnerText, 'recast.learnerText'),
    correctedText: text(o.correctedText, 'recast.correctedText'),
    errorTags: tags(o.errorTags, 'recast.errorTags'),
  };
}

function newWords(value: unknown): NewWord[] {
  return array(value, 'newWords', 0, 3).map((w, i) => {
    const o = object(w, `newWords[${i}]`, ['lemma', 'glossEn']);
    return { lemma: text(o.lemma, 'newWords.lemma'), glossEn: text(o.glossEn, 'newWords.glossEn') };
  });
}

function progress(value: unknown): ScenarioProgress {
  const o = object(value, 'scenarioProgress', ['goalsCompleted', 'done']);
  const goals = array(o.goalsCompleted, 'goalsCompleted', 0, Infinity).map((g, i) => {
    if (typeof g !== 'string' || !SLUG_RE.test(g)) {
      throw new ShapeError(`goalsCompleted[${i}] is invalid`);
    }
    return g;
  });
  if (typeof o.done !== 'boolean') throw new ShapeError('done must be a boolean');
  return { goalsCompleted: goals, done: o.done };
}

/**
 * Parse one tutor turn and check it against the spec's output schema (types,
 * required and unknown keys, lengths, tag and slug patterns). Strings are
 * trimmed. Semantic checks are left to {@link postValidate}.
 */
export function parseTutorOutput(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  try {
    const top = object(data, 'output', ['reply', 'annotations']);
    const reply = text(top.reply, 'reply');
    if (reply.length > MAX_REPLY) throw new ShapeError('reply is too long');
    const a = object(top.annotations, 'annotations', [
      'prompt',
      'recast',
      'newWords',
      'scenarioProgress',
    ]);
    const annotations: TutorAnnotations = {
      prompt: prompt(a.prompt),
      recast: recast(a.recast),
      newWords: newWords(a.newWords),
      scenarioProgress: progress(a.scenarioProgress),
    };
    return { ok: true, output: { reply, annotations } };
  } catch (e) {
    if (e instanceof ShapeError) return { ok: false, error: e.message };
    throw e;
  }
}

/** The reply decoded so far from a streaming JSON prefix. */
export interface PartialReply {
  text: string;
  /** True once the closing quote of `reply` has been decoded. */
  complete: boolean;
}

const WS = /\s/;

/**
 * Decode the `reply` string from the beginning of a tutor turn's JSON while
 * it streams, for example `{"reply":"Buongiorno! Co` gives `Buongiorno! Co`.
 * Escapes are decoded; an escape cut off at the end is held back. Returns
 * null until the reply's opening quote has arrived, or when the text does not
 * start like a tutor turn.
 */
export function partialReply(json: string): PartialReply | null {
  let i = 0;
  const skip = () => {
    while (i < json.length && WS.test(json[i] ?? '')) i += 1;
  };
  const expect = (literal: string): boolean | null => {
    for (const ch of literal) {
      if (i >= json.length) return null;
      if (json[i] !== ch) return false;
      i += 1;
    }
    return true;
  };
  skip();
  for (const part of ['{', '"reply"', ':', '"']) {
    const ok = expect(part);
    if (ok !== true) return null;
    if (part !== '"') skip();
  }
  const start = i;
  let end = i;
  let complete = false;
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"') {
      complete = true;
      break;
    }
    if (ch === '\\') {
      const next = json[i + 1];
      if (next === undefined) break;
      if (next === 'u') {
        if (i + 6 > json.length) break;
        i += 6;
      } else {
        i += 2;
      }
    } else {
      i += 1;
    }
    end = i;
  }
  let body = json.slice(start, end);
  // Hold back a high surrogate whose pair has not arrived yet.
  if (!complete && /\\u[dD][89abAB][0-9a-fA-F]{2}$/.test(body)) body = body.slice(0, -6);
  try {
    return { text: JSON.parse(`"${body}"`) as string, complete };
  } catch {
    return null;
  }
}
