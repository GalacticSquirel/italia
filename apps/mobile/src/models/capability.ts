/**
 * Device capability tiers, from total RAM (plan section 2b). The model
 * manager offers a model only when the device meets its `minRamBytes`.
 */
import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { CpuFeature } from './manifest';

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
  /** The primary CPU ABI (Android), or null when unknown or not Android. */
  abi: string | null;
  /** CPU features that native engine builds may need. */
  cpuFeatures: ReadonlySet<CpuFeature>;
  /** Whether a model with this RAM floor may be offered. */
  canRun(minRamBytes: number): boolean;
}

/**
 * The engine-relevant features in a Linux `/proc/cpuinfo`, named the way the
 * native loader names them (it reads the same file): `fp16` from `fphp` or
 * `fp16`, `dotprod` from `asimddp` or `dotprod`, and `i8mm`.
 */
export function parseCpuFeatures(cpuinfo: string): Set<CpuFeature> {
  const flags = new Set<string>();
  for (const line of cpuinfo.toLowerCase().split('\n')) {
    if (!line.startsWith('features') && !line.startsWith('flags')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    for (const flag of line
      .slice(colon + 1)
      .trim()
      .split(/\s+/))
      flags.add(flag);
  }
  const features = new Set<CpuFeature>();
  if (flags.has('fphp') || flags.has('fp16')) features.add('fp16');
  if (flags.has('asimddp') || flags.has('dotprod')) features.add('dotprod');
  if (flags.has('i8mm')) features.add('i8mm');
  return features;
}

/** Capability for a RAM size and CPU (pure; see {@link deviceCapability}). */
export function capabilityFor(
  totalMemoryBytes: number | null,
  cpu: { abi?: string | null; features?: Iterable<CpuFeature> } = {},
): DeviceCapability {
  return {
    totalMemoryBytes,
    tier: tierFor(totalMemoryBytes),
    abi: cpu.abi ?? null,
    cpuFeatures: new Set(cpu.features ?? []),
    // Unknown RAM: let the learner try; the OS will say if it cannot load.
    canRun: (min) => totalMemoryBytes === null || totalMemoryBytes >= min,
  };
}

/** This device's capability, from `expo-device`. */
export function deviceCapability(): DeviceCapability {
  cached ??= readDeviceCapability();
  return cached;
}

let cached: DeviceCapability | undefined;

function readDeviceCapability(): DeviceCapability {
  if (Platform.OS !== 'android') return capabilityFor(Device.totalMemory ?? null);
  let features = new Set<CpuFeature>();
  try {
    features = parseCpuFeatures(new File('file:///proc/cpuinfo').textSync());
  } catch {
    // Unreadable: only the engine build that needs no extra features matches.
  }
  return capabilityFor(Device.totalMemory ?? null, {
    abi: Device.supportedCpuArchitectures?.[0] ?? null,
    features,
  });
}
