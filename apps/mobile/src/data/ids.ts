import { randomUUID } from 'expo-crypto';

import type { CardKind, PromptMode } from '@italia/core';

/** Generates a new globally unique id. */
export type IdGenerator = () => string;

/** Default id generator: a random v4 UUID from the platform's secure RNG. */
export const newUuid: IdGenerator = () => randomUUID();

/**
 * The id of the card that practises `targetId` as `kind` in `promptMode`.
 *
 * Card ids are deterministic rather than random so that two devices (or a
 * device and a backup) that independently create the card for the same item
 * agree on its id, and their review logs merge by plain union.
 */
export function cardIdFor(kind: CardKind, targetId: number, promptMode: PromptMode): string {
  return `${kind}:${String(targetId)}:${promptMode}`;
}
