import { createFakeSpeechToText } from '@italia/core/testing';

import { createAutoStt } from './autoStt';

const audio = { kind: 'file', uri: 'file:///a.wav' } as const;

describe('createAutoStt', () => {
  it('prefers the downloaded model when it is ready', async () => {
    const primary = createFakeSpeechToText({ transcripts: ['model'] });
    const fallback = createFakeSpeechToText({ transcripts: ['phone'] });
    const stt = createAutoStt(primary, fallback);
    expect(await stt.availability()).toBe('ready');
    expect((await stt.transcribe(audio)).text).toBe('model');
    expect(fallback.received).toHaveLength(0);
  });

  it('falls back to the phone recognizer until the model is downloaded', async () => {
    const primary = createFakeSpeechToText({ availability: 'needs_download' });
    const fallback = createFakeSpeechToText({ transcripts: ['phone'] });
    const stt = createAutoStt(primary, fallback);
    expect(await stt.availability()).toBe('ready');
    expect((await stt.transcribe(audio)).text).toBe('phone');
  });

  it('reports what is missing when neither can run', async () => {
    const stt = createAutoStt(
      createFakeSpeechToText({ availability: 'needs_download' }),
      createFakeSpeechToText({ availability: 'unsupported' }),
    );
    expect(await stt.availability()).toBe('needs_download');
    await expect(stt.transcribe(audio)).rejects.toThrow(/No speech recognition/);
  });
});
