/**
 * The JSON Schema the runtime enforces as a grammar while the model decodes
 * (llama.cpp turns it into GBNF), so every reply parses.
 *
 * It starts from the spec's schema (`TUTOR_OUTPUT_SCHEMA`) and only narrows
 * it: error tags become an enum of the taxonomy and goal ids an enum of the
 * scenario's goals. Anything the narrowed schema accepts, the spec accepts.
 */
import { ERROR_TAGS, TUTOR_OUTPUT_SCHEMA } from './spec.generated';
import type { TutorScenario } from './types';

type Json = Record<string, unknown>;

const KEYS_NOT_FOR_GRAMMAR = new Set(['$schema', '$id', 'x-spec-version', 'description']);

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (value !== null && typeof value === 'object') {
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) {
      if (!KEYS_NOT_FOR_GRAMMAR.has(k)) out[k] = clone(v);
    }
    return out;
  }
  return value;
}

function at(schema: Json, ...path: string[]): Json {
  let node: unknown = schema;
  for (const key of path) {
    node = (node as Json | undefined)?.[key];
    if (node === null || typeof node !== 'object') {
      throw new Error(`tutor output schema has no ${path.join('.')}`);
    }
  }
  return node as Json;
}

/**
 * The output schema for one conversation: the spec schema with error tags and
 * scenario goal ids as enums. Annotations and titles are dropped (they do not
 * affect the grammar), property order is kept so `reply` streams first.
 */
export function runtimeOutputSchema(scenario: TutorScenario): Json {
  const schema = clone(TUTOR_OUTPUT_SCHEMA) as Json;
  const tagIds = ERROR_TAGS.map((t) => t.id);
  for (const def of ['Prompt', 'Recast']) {
    const items = at(schema, '$defs', def, 'properties', 'errorTags', 'items');
    delete items.pattern;
    items.enum = tagIds;
  }
  const goals = at(schema, '$defs', 'ScenarioProgress', 'properties', 'goalsCompleted');
  const goalItems = at(goals, 'items');
  delete goalItems.pattern;
  goalItems.enum = scenario.goals.map((g) => g.id);
  goals.maxItems = scenario.goals.length;
  return schema;
}
