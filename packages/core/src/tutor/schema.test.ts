import { describe, expect, it } from 'vitest';

import { runtimeOutputSchema } from './schema';
import { ERROR_TAGS, SCENARIOS, TUTOR_OUTPUT_SCHEMA } from './spec.generated';

const bar = SCENARIOS.find((s) => s.id === 'bar-colazione');
if (!bar) throw new Error('bar-colazione missing');

type Json = Record<string, unknown>;
const get = (node: unknown, ...path: string[]): Json =>
  path.reduce<unknown>((n, k) => (n as Json)[k], node) as Json;

/** Undo the runtime narrowing, so what is left must equal the spec schema. */
function widen(schema: Json): unknown {
  const copy = JSON.parse(JSON.stringify(schema)) as Json;
  for (const def of ['Prompt', 'Recast']) {
    const items = get(copy, '$defs', def, 'properties', 'errorTags', 'items');
    delete items.enum;
    items.pattern = '^[a-z][a-z0-9-]*$';
  }
  const goals = get(copy, '$defs', 'ScenarioProgress', 'properties', 'goalsCompleted');
  delete goals.maxItems;
  const goalItems = get(goals, 'items');
  delete goalItems.enum;
  goalItems.pattern = '^[a-z0-9][a-z0-9-]*$';
  return copy;
}

function stripDocs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripDocs);
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !['$schema', '$id', 'x-spec-version', 'description'].includes(k))
        .map(([k, v]) => [k, stripDocs(v)]),
    );
  }
  return node;
}

describe('runtimeOutputSchema', () => {
  const schema = runtimeOutputSchema(bar);

  it('only narrows the spec schema', () => {
    expect(widen(schema)).toEqual(stripDocs(TUTOR_OUTPUT_SCHEMA));
  });

  it('constrains error tags to the taxonomy and goals to the scenario', () => {
    const tags = get(schema, '$defs', 'Recast', 'properties', 'errorTags', 'items');
    expect(tags.enum).toEqual(ERROR_TAGS.map((t) => t.id));
    const goals = get(schema, '$defs', 'ScenarioProgress', 'properties', 'goalsCompleted');
    expect(get(goals, 'items').enum).toEqual(['greet', 'order-drink', 'order-food', 'pay']);
    expect(goals.maxItems).toBe(4);
  });

  it('keeps reply as the first property so it streams first', () => {
    expect(Object.keys(get(schema, 'properties'))).toEqual(['reply', 'annotations']);
    expect(get(schema, 'required')).toEqual(['reply', 'annotations']);
  });

  it('does not change the shared spec object', () => {
    expect(
      get(TUTOR_OUTPUT_SCHEMA, '$defs', 'Prompt', 'properties', 'errorTags', 'items').enum,
    ).toBeUndefined();
  });
});
