import { TIER_DESCRIPTIONS, TIER_MIN_RAM_BYTES, type DeviceTier } from './capability';
import { MANIFEST } from './manifest';

/** The model kind each tier's description promises, and the lowest tier promising it. */
const PROMISED: readonly { kind: string; tier: DeviceTier }[] = [
  { kind: 'stt', tier: 'low' },
  { kind: 'phonemes', tier: 'low' },
];

describe('device tiers and the model manifest', () => {
  it.each(PROMISED)(
    'every $kind model runs on the $tier tier it is promised for',
    ({ kind, tier }) => {
      expect(TIER_DESCRIPTIONS[tier]).toBeTruthy();
      const models = MANIFEST.models.filter((m) => m.kind === kind);
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.minRamBytes).toBeLessThanOrEqual(TIER_MIN_RAM_BYTES[tier]);
      }
    },
  );
});
