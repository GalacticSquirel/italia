/**
 * Pure helpers for mono PCM audio: joining stream buffers, resampling to the
 * 16 kHz the speech models expect, waveform envelopes, and WAV encoding.
 */

/** Sample rate of every speech model in the app. */
export const MODEL_SAMPLE_RATE = 16_000;

/** Join chunks into one array. */
export function concatFloat32(chunks: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Mix interleaved multi-channel audio down to mono. */
export function toMono(samples: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return samples;
  const out = new Float32Array(Math.floor(samples.length / channels));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c] ?? 0;
    out[i] = sum / channels;
  }
  return out;
}

/**
 * Resample by linear interpolation, after a box low-pass when downsampling
 * (enough for speech models, which ignore content above 8 kHz).
 */
export function resampleLinear(samples: Float32Array, fromHz: number, toHz: number): Float32Array {
  if (fromHz === toHz || samples.length === 0) return samples;
  if (!(fromHz > 0 && toHz > 0)) throw new RangeError('sample rates must be positive');
  let source = samples;
  const ratio = fromHz / toHz;
  if (ratio > 1) {
    const width = Math.max(1, Math.round(ratio));
    source = new Float32Array(samples.length);
    let acc = 0;
    for (let i = 0; i < samples.length; i++) {
      acc += samples[i] ?? 0;
      if (i >= width) acc -= samples[i - width] ?? 0;
      source[i] = acc / Math.min(width, i + 1);
    }
  }
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const k = Math.floor(pos);
    const frac = pos - k;
    const a = source[k] ?? 0;
    const b = source[Math.min(k + 1, source.length - 1)] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Duration of `count` samples in milliseconds. */
export function durationMs(count: number, sampleRateHz: number): number {
  return Math.round((count / sampleRateHz) * 1000);
}

/**
 * Waveform envelope: the peak absolute amplitude in each of `buckets` equal
 * slices, scaled so the loudest is 1 (all zeros for silence).
 */
export function envelope(samples: Float32Array, buckets: number): number[] {
  const n = Math.max(1, Math.floor(buckets));
  const out = new Array<number>(n).fill(0);
  if (samples.length === 0) return out;
  for (let b = 0; b < n; b++) {
    const start = Math.floor((b * samples.length) / n);
    const end = Math.max(start + 1, Math.floor(((b + 1) * samples.length) / n));
    let peak = 0;
    for (let i = start; i < end && i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    }
    out[b] = peak;
  }
  const max = Math.max(...out);
  return max > 0 ? out.map((v) => v / max) : out;
}

/** Encode mono float samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRateHz: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Root-mean-square level of the samples (0 for none). */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}
