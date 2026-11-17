import { createModelFileRepo, type ModelFileRepo } from '@/data';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';

import { capabilityFor, tierFor } from './capability';
import { MANIFEST, parseManifest, type Manifest } from './manifest';
import {
  InsufficientStorageError,
  ModelManager,
  NotOnWifiError,
  OfflineError,
  type ConnectionType,
} from './modelManager';
import { FakeStorage } from './testing';

const GIB = 1024 ** 3;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const manifest: Manifest = parseManifest({
  version: 2,
  models: [
    {
      id: 'stt-test',
      kind: 'stt',
      title: 'Speech recognition',
      description: 'Test model.',
      licence: 'MIT',
      source: 'https://example.com/stt',
      minRamBytes: 4 * GIB,
      files: [
        {
          name: 'a.onnx',
          url: 'https://example.com/a.onnx',
          sha256: SHA_A,
          sizeBytes: 100,
          verification: 'downloaded',
        },
        {
          name: 'b.txt',
          url: 'https://example.com/b.txt',
          sha256: SHA_B,
          sizeBytes: 10,
          verification: 'downloaded',
        },
      ],
    },
    {
      id: 'voice-test',
      kind: 'tts',
      title: 'Voice',
      description: 'Archive.',
      licence: 'MIT',
      source: 'https://example.com/voice',
      minRamBytes: 0,
      rootDir: 'voice',
      files: [
        {
          name: 'voice.tar.bz2',
          url: 'https://example.com/voice.tar.bz2',
          sha256: SHA_A,
          sizeBytes: 100,
          verification: 'downloaded',
          extract: 'tar.bz2',
        },
      ],
    },
    {
      id: 'later',
      kind: 'phonemes',
      title: 'Later',
      description: 'Not uploaded.',
      licence: 'MIT',
      source: 'https://example.com/later',
      minRamBytes: 0,
      files: [
        {
          name: 'x.onnx',
          url: 'https://example.com/x.onnx',
          sha256: SHA_A,
          sizeBytes: 5,
          verification: 'built',
          available: false,
        },
      ],
    },
  ],
});

let t: TestDatabase;
let repo: ModelFileRepo;
let storage: FakeStorage;
let connection: ConnectionType;

function manager(ram: number | null = 8 * GIB) {
  return new ModelManager({
    manifest,
    repo,
    storage,
    network: { connection: () => Promise.resolve(connection) },
    capability: capabilityFor(ram),
  });
}

beforeEach(() => {
  t = createTestDatabase();
  repo = createModelFileRepo(t.db);
  storage = new FakeStorage();
  storage.served.set('https://example.com/a.onnx', { size: 100, sha: SHA_A });
  storage.served.set('https://example.com/b.txt', { size: 10, sha: SHA_B });
  storage.served.set('https://example.com/voice.tar.bz2', { size: 100, sha: SHA_A });
  connection = 'wifi';
});

afterEach(() => {
  t.close();
});

describe('ModelManager', () => {
  it('parses the bundled manifest', () => {
    expect(MANIFEST.models.map((m) => m.kind)).toEqual(
      expect.arrayContaining(['stt', 'phonemes', 'tts']),
    );
  });

  it('lists models with their status', () => {
    const m = manager(2 * GIB);
    expect(m.getSnapshot().map((v) => [v.spec.id, v.status])).toEqual([
      ['stt-test', 'unsupported'],
      ['voice-test', 'not_installed'],
      ['later', 'unavailable'],
    ]);
  });

  it('downloads, verifies and installs every file', async () => {
    const m = manager();
    const seen: string[] = [];
    m.subscribe(() => seen.push(m.view('stt-test')?.status ?? ''));
    await m.install('stt-test');
    expect(m.view('stt-test')).toMatchObject({ status: 'installed', bytesDone: 110 });
    expect(seen).toContain('downloading');
    expect(seen).toContain('verifying');
    expect(m.installedDir('stt-test')).toBe('file:///models/stt-test');
    expect(m.installedOfKind('stt')?.spec.id).toBe('stt-test');
    expect(m.storageUsedBytes()).toBe(110);
    // A new manager (app restart) sees the installed state from SQLite.
    expect(manager().view('stt-test')?.status).toBe('installed');
  });

  it('extracts archives after verifying them and uses their root folder', async () => {
    const m = manager();
    await m.install('voice-test');
    expect(storage.extracted).toEqual([
      'file:///models/voice-test/voice.tar.bz2->file:///models/voice-test',
    ]);
    expect(m.installedDir('voice-test')).toBe('file:///models/voice-test/voice');
  });

  it('fails and deletes a file whose checksum does not match', async () => {
    storage.served.set('https://example.com/b.txt', { size: 10, sha: SHA_A });
    const m = manager();
    await expect(m.install('stt-test')).rejects.toThrow(/checksum/);
    expect(m.view('stt-test')).toMatchObject({
      status: 'failed',
      error: 'b.txt failed its checksum.',
    });
    expect(storage.files.has('file:///models/stt-test/b.txt')).toBe(false);
    expect(m.installedDir('stt-test')).toBeNull();
  });

  it('fails a file with the wrong size', async () => {
    storage.served.set('https://example.com/a.onnx', { size: 99, sha: SHA_A });
    await expect(manager().install('stt-test')).rejects.toThrow(/99 bytes/);
  });

  it('pauses and resumes with the saved resume data, across restarts', async () => {
    storage.hold = true;
    const m = manager();
    const run = m.install('stt-test');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.view('stt-test')?.status).toBe('downloading');
    m.pause('stt-test');
    await run;
    expect(m.view('stt-test')).toMatchObject({ status: 'paused', bytesDone: 3 });

    storage.hold = false;
    const restarted = manager();
    await restarted.install('stt-test');
    expect(storage.pending[1]?.resumeData).toBe('resume:https://example.com/a.onnx');
    expect(restarted.view('stt-test')?.status).toBe('installed');
  });

  it('treats a download left running by a killed app as paused', () => {
    repo.put({
      modelId: 'stt-test',
      name: 'a.onnx',
      sha256: SHA_A,
      status: 'downloading',
      bytesDone: 50,
      resumeData: null,
      error: null,
    });
    expect(manager().view('stt-test')).toMatchObject({ status: 'paused', bytesDone: 50 });
  });

  it('reinstalls a file when the manifest checksum changes', async () => {
    repo.put({
      modelId: 'stt-test',
      name: 'a.onnx',
      sha256: SHA_B,
      status: 'installed',
      bytesDone: 100,
      resumeData: null,
      error: null,
    });
    const m = manager();
    expect(m.view('stt-test')?.status).toBe('not_installed');
    await m.install('stt-test');
    expect(m.view('stt-test')?.status).toBe('installed');
  });

  it('needs Wi-Fi unless mobile data is allowed, and a connection', async () => {
    connection = 'cellular';
    await expect(manager().install('stt-test')).rejects.toBeInstanceOf(NotOnWifiError);
    await manager().install('stt-test', { allowCellular: true });
    connection = 'none';
    await expect(manager().install('voice-test')).rejects.toBeInstanceOf(OfflineError);
  });

  it('checks free storage, counting archives twice', async () => {
    storage.free = 100;
    await expect(manager().install('voice-test')).rejects.toBeInstanceOf(InsufficientStorageError);
  });

  it('refuses models that are unavailable or too big for the device', async () => {
    await expect(manager().install('later')).rejects.toThrow(/cannot be installed/);
    await expect(manager(GIB).install('stt-test')).rejects.toThrow(/cannot be installed/);
  });

  it('removes a model and its files', async () => {
    const m = manager();
    await m.install('stt-test');
    await m.remove('stt-test');
    expect(m.view('stt-test')?.status).toBe('not_installed');
    expect(storage.files.size).toBe(0);
    expect(repo.list('stt-test')).toEqual([]);
  });
});

describe('capability tiers', () => {
  it('maps RAM to tiers', () => {
    expect(tierFor(null)).toBe('minimal');
    expect(tierFor(3 * GIB)).toBe('minimal');
    expect(tierFor(3.7 * GIB)).toBe('low');
    expect(tierFor(7.4 * GIB)).toBe('mid');
    expect(tierFor(11.5 * GIB)).toBe('high');
    expect(capabilityFor(null).canRun(GIB)).toBe(true);
    expect(capabilityFor(2 * GIB).canRun(4 * GIB)).toBe(false);
  });
});
