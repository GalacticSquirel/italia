import { concatFloat32, durationMs, encodeWav, envelope, resampleLinear, rms, toMono } from './pcm';

const sine = (hz: number, rate: number, seconds: number) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) =>
    Math.sin((2 * Math.PI * hz * i) / rate),
  );

describe('pcm helpers', () => {
  it('joins chunks and mixes to mono', () => {
    expect([...concatFloat32([Float32Array.of(1, 2), Float32Array.of(3)])]).toEqual([1, 2, 3]);
    expect([...toMono(Float32Array.of(1, 0, 0.5, 0.5), 2)]).toEqual([0.5, 0.5]);
  });

  it('resamples 48 kHz speech to 16 kHz, keeping duration and level', () => {
    const input = sine(220, 48_000, 0.5);
    const out = resampleLinear(input, 48_000, 16_000);
    expect(out.length).toBe(8000);
    expect(durationMs(out.length, 16_000)).toBe(500);
    expect(rms(out)).toBeCloseTo(rms(input), 1);
    expect(resampleLinear(input, 16_000, 16_000)).toBe(input);
    expect(resampleLinear(sine(220, 8000, 0.1), 8000, 16_000).length).toBe(1600);
    expect(() => resampleLinear(input, 0, 16_000)).toThrow(RangeError);
  });

  it('builds a normalised waveform envelope', () => {
    const samples = Float32Array.of(0, 0.1, 0, 0.5, 0, 0.25);
    const env = envelope(samples, 3);
    expect(env[0]).toBeCloseTo(0.2);
    expect(env.slice(1)).toEqual([1, 0.5]);
    expect(envelope(new Float32Array(0), 2)).toEqual([0, 0]);
  });

  it('encodes a 16-bit mono WAV', () => {
    const wav = encodeWav(Float32Array.of(0, 1, -1), 16_000);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
});
