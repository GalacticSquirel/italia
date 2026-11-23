/**
 * Device capability tiers, from the phone's RAM size (plan section 2b). The
 * model manager offers a model only when the phone's RAM size meets its
 * `minRamBytes`.
 *
 * Phones report less RAM than they were sold with, because firmware, the
 * modem and the GPU reserve some of it: an "8 GB" phone reports about
 * 7.3 GiB and a 12 GB Galaxy S25+ under 11 GiB. Comparing the reported
 * figure with a floor just under the nominal size therefore wrongly turns
 * phones away whenever a vendor reserves more than usual. Instead the app
 * works out the nominal size the phone was sold with ({@link nominalRamBytes})
 * and compares that with nominal floors, the same "for phones with 12 GB"
 * that the model descriptions state.
 */
import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { CpuFeature } from './manifest';

const GIB = 1024 ** 3;

/**
 * RAM sizes that phones and tablets ship with, in GiB, ascending. Memory chips
 * come in these sizes, so the reported total sits a little under one of them.
 */
export const NOMINAL_RAM_GIB: readonly number[] = [
  1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24, 32, 48, 64,
];

/**
 * The RAM size a device was sold with, from the total the OS reports: the
 * smallest nominal size not below it. Null when the OS does not say. A report
 * above every listed size is returned as it is.
 */
export function nominalRamBytes(totalMemoryBytes: number | null): number | null {
  if (totalMemoryBytes === null || totalMemoryBytes <= 0) return null;
  const size = NOMINAL_RAM_GIB.find((gib) => gib * GIB >= totalMemoryBytes);
  return size === undefined ? totalMemoryBytes : size * GIB;
}

/** Device tier by nominal RAM size. */
export type DeviceTier = 'minimal' | 'low' | 'mid' | 'high';

/** Least nominal RAM size of each tier. */
export const TIER_MIN_RAM_BYTES: Readonly<Record<DeviceTier, number>> = {
  minimal: 0,
  low: 4 * GIB,
  mid: 8 * GIB,
  high: 12 * GIB,
};

/** What each tier can run, for display. */
export const TIER_DESCRIPTIONS: Readonly<Record<DeviceTier, string>> = {
  minimal: 'Reviews, reading and ear training. Speaking uses the phone’s own recognizer.',
  low: 'Adds on-device speech recognition and pronunciation scoring.',
  mid: 'Adds the smaller conversation model.',
  high: 'Runs everything, including the larger conversation model.',
};

/** The tier for a nominal RAM size; unknown RAM counts as `minimal`. */
export function tierFor(nominalMemoryBytes: number | null): DeviceTier {
  const ram = nominalMemoryBytes ?? 0;
  if (ram >= TIER_MIN_RAM_BYTES.high) return 'high';
  if (ram >= TIER_MIN_RAM_BYTES.mid) return 'mid';
  if (ram >= TIER_MIN_RAM_BYTES.low) return 'low';
  return 'minimal';
}

/** What the device offers. */
export interface DeviceCapability {
  /** Total RAM the OS reports, in bytes, or null when it does not say. */
  totalMemoryBytes: number | null;
  /** The RAM size the phone was sold with ({@link nominalRamBytes}). */
  nominalMemoryBytes: number | null;
  tier: DeviceTier;
  /** The primary CPU ABI (Android), or null when unknown or not Android. */
  abi: string | null;
  /** CPU features that native engine builds may need. */
  cpuFeatures: ReadonlySet<CpuFeature>;
  /** Whether a model needing this nominal RAM size may be offered. */
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

/**
 * Capability for the RAM total the OS reports and the CPU (pure; see
 * {@link deviceCapability}).
 */
export function capabilityFor(
  totalMemoryBytes: number | null,
  cpu: { abi?: string | null; features?: Iterable<CpuFeature> } = {},
): DeviceCapability {
  const nominal = nominalRamBytes(totalMemoryBytes);
  return {
    totalMemoryBytes,
    nominalMemoryBytes: nominal,
    tier: tierFor(nominal),
    abi: cpu.abi ?? null,
    cpuFeatures: new Set(cpu.features ?? []),
    // Unknown RAM: let the learner try; the OS will say if it cannot load.
    canRun: (min) => nominal === null || nominal >= min,
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
