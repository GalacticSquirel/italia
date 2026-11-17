/**
 * The on-device tutor contract (spec v1): the TypeScript port of
 * `training/spec` (prompt rendering, output schema, parsing, the guard rails
 * on the model's annotations) and the conversation state machine.
 */
export * from './conversation';
export * from './parse';
export * from './profile';
export * from './render';
export * from './schema';
export {
  ERROR_TAGS,
  GRAMMAR_POINTS,
  LEVEL_BANDS,
  SCENARIOS,
  SPEC_VERSION,
  START_MESSAGE,
  SYSTEM_PROMPT_TEMPLATE,
  TAXONOMY_VERSION,
  TUTOR_OUTPUT_SCHEMA,
} from './spec.generated';
export * from './types';
export * from './validate';
