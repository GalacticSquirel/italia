/** Battery state from expo-battery, for the tutor's power advice. */
import * as Battery from 'expo-battery';

import type { BatteryState } from './power';

/** Read the battery; unknown values come back as null / false, never an error. */
export async function readBattery(): Promise<BatteryState> {
  try {
    const state = await Battery.getPowerStateAsync();
    return {
      level: state.batteryLevel >= 0 ? state.batteryLevel : null,
      charging:
        state.batteryState === Battery.BatteryState.CHARGING ||
        state.batteryState === Battery.BatteryState.FULL,
      lowPowerMode: state.lowPowerMode,
    };
  } catch {
    return { level: null, charging: false, lowPowerMode: false };
  }
}
