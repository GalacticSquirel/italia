import { clipKey } from './clipKey';
import { createClipLibrary, shardOf, type InstalledPack } from './clipLibrary';

const SARA = { id: 'kokoro-if_sara', name: 'Sara', gender: 'female', native: false };
const NICOLA = { id: 'kokoro-im_nicola', name: 'Nicola', gender: 'male', native: false };
const SERENA = { id: 'piper-serena', name: 'Serena', gender: 'female', native: false };

function index(pack: string, shard: string, voice: typeof SARA, clips: Record<string, unknown[]>) {
  return JSON.stringify({ format: 1, pack, shard, voice, clips });
}

function setup() {
  const files: Record<string, string> = {
    'file:///m/audio-voice-sara/s000/index.json': index('audio-voice-sara', 's000', SARA, {
      [clipKey('Ciao, Marco.')]: [
        {
          f: 'aa/a.m4a',
          ms: 900,
          w: [
            [0, 4, 100, 400],
            [6, 11, 450, 800],
          ],
        },
      ],
    }),
    'file:///m/audio-voice-sara/s001/index.json': index('audio-voice-sara', 's001', SARA, {
      [clipKey('Buongiorno.')]: [{ f: 'bb/b.m4a', ms: 700 }],
    }),
    'file:///m/audio-voice-nicola/s000/index.json': index('audio-voice-nicola', 's000', NICOLA, {
      [clipKey('Ciao, Marco.')]: [{ f: 'cc/c.m4a', ms: 950 }],
    }),
    'file:///m/audio-words/s000/index.json': index('audio-words', 's000', SERENA, {
      [clipKey('casa')]: [
        { f: 'dd/d-0.m4a', ms: 600, by: 'LangPao', lic: 'CC BY-SA 4.0', src: 'https://c/1' },
        { f: 'dd/d-1.m4a', ms: 640, by: 'Ciampix', lic: 'CC BY-SA 4.0', src: 'https://c/2' },
      ],
      [clipKey('cane')]: [{ f: 'ee/e.m4a', ms: 500 }],
    }),
  };
  let installed: InstalledPack[] = [
    {
      id: 'audio-voice-sara',
      dir: 'file:///m/audio-voice-sara',
      files: ['audio-voice-sara-s000.tar.zst', 'audio-voice-sara-s001.tar.zst'],
    },
    {
      id: 'audio-voice-nicola',
      dir: 'file:///m/audio-voice-nicola',
      files: ['audio-voice-nicola-s000.tar.zst'],
    },
    { id: 'audio-words', dir: 'file:///m/audio-words', files: ['audio-words-s000.tar.zst'] },
  ];
  const reads: string[] = [];
  const library = createClipLibrary({
    installed: () => installed,
    readText: (uri) => {
      reads.push(uri);
      const text = files[uri];
      return text === undefined ? Promise.reject(new Error('missing')) : Promise.resolve(text);
    },
  });
  return {
    library,
    reads,
    setInstalled: (next: InstalledPack[]) => {
      installed = next;
    },
  };
}

describe('clip library', () => {
  it('parses shard names', () => {
    expect(shardOf('audio-voice-sara-s012.tar.zst')).toBe('s012');
    expect(shardOf('model.onnx')).toBeNull();
  });

  it('finds clips across shards with their timings', async () => {
    const { library } = setup();
    const clip = await library.lookup('  Buongiorno. ');
    expect(clip).toMatchObject({
      uri: 'file:///m/audio-voice-sara/s001/bb/b.m4a',
      durationMs: 700,
      timings: null,
      voice: SARA,
      credit: null,
    });
    const timed = await library.lookup('Ciao, Marco.', { packId: 'audio-voice-sara' });
    expect(timed?.timings).toEqual([
      { charStart: 0, charEnd: 4, startMs: 100, endMs: 400 },
      { charStart: 6, charEnd: 11, startMs: 450, endMs: 800 },
    ]);
    expect(await library.lookup('Non esiste.')).toBeNull();
  });

  it('alternates voices on each play, or keeps the one asked for', async () => {
    const { library } = setup();
    const first = await library.lookup('Ciao, Marco.');
    const second = await library.lookup('Ciao, Marco.');
    expect(new Set([first?.packId, second?.packId])).toEqual(
      new Set(['audio-voice-sara', 'audio-voice-nicola']),
    );
    const pinned = await library.lookup('Ciao, Marco.', { packId: 'audio-voice-nicola' });
    expect(pinned?.voice).toEqual(NICOLA);
  });

  it('prefers native speakers and rotates between them, with credit', async () => {
    const { library } = setup();
    const a = await library.lookup('casa');
    const b = await library.lookup('casa');
    expect(new Set([a?.credit?.by, b?.credit?.by])).toEqual(new Set(['LangPao', 'Ciampix']));
    expect(a?.credit?.licence).toBe('CC BY-SA 4.0');
    expect((await library.lookup('cane'))?.credit).toBeNull();
  });

  it('lists sentence voices and reloads when packs change', async () => {
    const { library, reads, setInstalled } = setup();
    expect(await library.voices()).toEqual([
      { packId: 'audio-voice-nicola', voice: NICOLA },
      { packId: 'audio-voice-sara', voice: SARA },
    ]);
    const before = reads.length;
    await library.lookup('casa');
    expect(reads.length).toBe(before);
    setInstalled([]);
    expect(await library.lookup('casa')).toBeNull();
  });

  it('skips a damaged shard', async () => {
    const { library, setInstalled } = setup();
    setInstalled([
      { id: 'audio-voice-x', dir: 'file:///m/x', files: ['audio-voice-x-s000.tar.zst'] },
    ]);
    expect(await library.lookup('casa')).toBeNull();
  });
});
