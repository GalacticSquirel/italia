/**
 * Test-only fake of the clip library. Never import from app code.
 */
import type { Clip, ClipLibrary, ClipQuery, ClipVoice } from './clipLibrary';

const SARA: ClipVoice = { id: 'kokoro-if_sara', name: 'Sara', gender: 'female', native: false };

/** A fake {@link ClipLibrary} serving the given clips by exact text. */
export function createFakeClipLibrary(
  clips: Record<string, Partial<Clip>> = {},
): ClipLibrary & { lookups: { text: string; query: ClipQuery }[] } {
  const fake = {
    lookups: [] as { text: string; query: ClipQuery }[],
    lookup(text: string, query: ClipQuery = {}) {
      fake.lookups.push({ text, query });
      const found = clips[text];
      if (!found) return Promise.resolve(null);
      return Promise.resolve<Clip>({
        uri: `file:///clips/${encodeURIComponent(text)}.m4a`,
        durationMs: 1000,
        timings: null,
        packId: query.packId ?? 'audio-voice-sara',
        voice: SARA,
        credit: null,
        ...found,
      });
    },
    voices() {
      return Promise.resolve(
        Object.keys(clips).length > 0 ? [{ packId: 'audio-voice-sara', voice: SARA }] : [],
      );
    },
    reset() {
      // Nothing cached.
    },
  };
  return fake;
}
