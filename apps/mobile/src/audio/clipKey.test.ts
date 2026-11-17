import { createHash } from 'node:crypto';

import { clipKey, normaliseSpoken, sha256Hex } from './clipKey';
import vectors from '../../../../audio/tests/clip-keys.json';

describe('clip keys', () => {
  it('match the audio build for the shared vectors', () => {
    for (const v of vectors) {
      expect(normaliseSpoken(v.text)).toBe(v.normalised);
      expect(clipKey(v.text)).toBe(v.key);
    }
  });

  it('computes SHA-256 like Node for short, long and non-Latin text', () => {
    for (const text of ['', 'abc', 'perché è così', 'x'.repeat(200), '🇮🇹 ciao', 'a'.repeat(55)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});
