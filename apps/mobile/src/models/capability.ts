/**
 * Device capability tiers, from total RAM (plan section 2b). The model
 * manager offers a model only when the device meets its `minRamBytes`.
 */
import * as Device from 'expo-device';

const GIB = 1024 ** 3;

/** Device tier by total RAM. */
export type DeviceTier = 'minimal' | 'low' | 'mid' | 'high';

/**
 * Lower RAM bound of each tier. Phones report a little less than their
 * marketing size (for example 7.4 GiB for an "8 GB" phone), so the bounds
 * sit just under the nominal sizes.
 */
export const TIER_MIN_RAM_BYTES: Readonly<Record<DeviceTier, number>> = {
  minimal: 0,
  low: 3.5 * GIB,
  mid: 7 * GIB,
  high: 11 * GIB,
};

/** What each tier can run, for display. */
export const TIER_DESCRIPTIONS: Readonly<Record<DeviceTier, string>> = {
  minimal: 'Reviews, reading and ear training. Speaking uses the phone’s own recognizer.',
  low: 'Adds on-device speech recognition and pronunciation scoring.',
  mid: 'Adds the smaller conversation model when it arrives.',
  high: 'Runs everything, including the larger conversation model.',
};

/** The tier for a RAM size; unknown RAM counts as `minimal`. */
export function tierFor(totalMemoryBytes: number | null): DeviceTier {
  const ram = totalMemoryBytes ?? 0;
  if (ram >= TIER_MIN_RAM_BYTES.high) return 'high';
  if (ram >= TIER_MIN_RAM_BYTES.mid) return 'mid';
  if (ram >= TIER_MIN_RAM_BYTES.low) return 'low';
  return 'minimal';
}

/** What the device offers. */
export interface DeviceCapability {
  /** Total RAM in bytes, or null when the OS does not say. */
  totalMemoryBytes: number | null;
  tier: DeviceTier;
  /** Whether a model with this RAM floor may be offered. */
  canRun(minRamBytes: number): boolean;
}

/** Capability for a RAM size (pure; see {@link deviceCapability}). */
export function capabilityFor(totalMemoryBytes: number | null): DeviceCapability {
  return {
    totalMemoryBytes,
    tier: tierFor(totalMemoryBytes),
    // Unknown RAM: let the learner try; the OS will say if it cannot load.
    canRun: (min) => totalMemoryBytes === null || totalMemoryBytes >= min,
  };
}

/** This device's capability, from `expo-device`. */
export function deviceCapability(): DeviceCapability {
  return capabilityFor(Device.totalMemory ?? null);
}
