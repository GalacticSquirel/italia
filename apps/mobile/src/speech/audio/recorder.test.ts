import { AudioModule, setAudioModeAsync } from 'expo-audio';

import { createStreamRecorder } from './recorder';

interface FakeStream {
  start: jest.Mock;
  stop: jest.Mock;
  startFileRecordingAsync: jest.Mock;
  stopFileRecordingAsync: jest.Mock;
  addListener: jest.Mock;
}

let streams: FakeStream[];

function fakeStream(overrides: Partial<FakeStream> = {}): FakeStream {
  return {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
    startFileRecordingAsync: jest.fn(() => Promise.resolve()),
    stopFileRecordingAsync: jest.fn(() =>
      Promise.resolve({ uri: 'file://a.wav', sampleRate: 16000 }),
    ),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    ...overrides,
  };
}

const AudioStream = AudioModule.AudioStream as unknown as jest.Mock;
const audioMode = setAudioModeAsync as jest.Mock;

beforeEach(() => {
  streams = [];
  audioMode.mockClear();
});

function nextStream(overrides: Partial<FakeStream> = {}) {
  AudioStream.mockImplementationOnce(() => {
    const s = fakeStream(overrides);
    streams.push(s);
    return s;
  });
}

const leftRecordingMode = () =>
  audioMode.mock.calls.some(([mode]) => !(mode as { allowsRecording: boolean }).allowsRecording);

describe('createStreamRecorder', () => {
  it('stops the microphone when file recording fails to start', async () => {
    nextStream({ startFileRecordingAsync: jest.fn(() => Promise.reject(new Error('no disk'))) });
    const recorder = createStreamRecorder();
    await expect(recorder.start()).rejects.toThrow('no disk');
    expect(streams[0]?.stop).toHaveBeenCalled();
    expect(leftRecordingMode()).toBe(true);
  });

  it('stops the microphone when stopping the file fails', async () => {
    nextStream({ stopFileRecordingAsync: jest.fn(() => Promise.reject(new Error('io'))) });
    const recorder = createStreamRecorder();
    await recorder.start();
    await expect(recorder.stop()).rejects.toThrow('io');
    expect(streams[0]?.stop).toHaveBeenCalled();
    await expect(recorder.stop()).rejects.toThrow('Not recording');
  });

  it('leaves recording mode when cancelled', async () => {
    nextStream();
    const recorder = createStreamRecorder();
    await recorder.start();
    audioMode.mockClear();
    recorder.cancel();
    expect(streams[0]?.stop).toHaveBeenCalled();
    expect(leftRecordingMode()).toBe(true);
    // Cancelling when idle does nothing.
    audioMode.mockClear();
    recorder.cancel();
    expect(audioMode).not.toHaveBeenCalled();
  });
});
