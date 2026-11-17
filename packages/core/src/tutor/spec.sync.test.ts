import { describe, expect, it } from 'vitest';

import { isCurrent } from '../../scripts/generate-tutor-spec.mjs';

describe('tutor spec sync', () => {
  it('spec.generated.ts matches training/spec (run scripts/generate-tutor-spec.mjs)', async () => {
    expect(await isCurrent()).toBe(true);
  });
});
