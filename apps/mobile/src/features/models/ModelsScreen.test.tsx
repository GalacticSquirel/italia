import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createModelFileRepo, createRepositories } from '@/data';
import { RepositoryProvider } from '@/db';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';
import { capabilityFor, ModelManager, ModelsProvider, parseManifest } from '@/models';
import { FakeStorage } from '@/models/testing';
import { ThemeProvider } from '@/ui';

import { formatBytes } from './format';
import { ModelsScreen } from './ModelsScreen';

const GIB = 1024 ** 3;

const manifest = parseManifest({
  version: 2,
  models: [
    {
      id: 'stt',
      kind: 'stt',
      title: 'Speech recognition',
      description: 'Turns speech into text.',
      licence: 'CC-BY-4.0',
      source: 'https://example.com',
      minRamBytes: 4 * GIB,
      files: [
        {
          name: 'm.onnx',
          url: 'https://example.com/m.onnx',
          sha256: 'a'.repeat(64),
          sizeBytes: 5_000_000,
          verification: 'downloaded',
        },
      ],
    },
    {
      id: 'later',
      kind: 'phonemes',
      title: 'Pronunciation scoring',
      description: 'Scores sounds.',
      licence: 'MIT',
      source: 'https://example.com',
      minRamBytes: 0,
      files: [
        {
          name: 'p.onnx',
          url: 'https://example.com/p.onnx',
          sha256: 'b'.repeat(64),
          sizeBytes: 1_000_000,
          verification: 'built',
          available: false,
        },
      ],
    },
  ],
});

let t: TestDatabase;

beforeEach(() => {
  t = createTestDatabase();
});
afterEach(() => {
  t.close();
});

async function renderScreen(ram: number) {
  const storage = new FakeStorage();
  storage.served.set('https://example.com/m.onnx', { size: 5_000_000, sha: 'a'.repeat(64) });
  const manager = new ModelManager({
    manifest,
    repo: createModelFileRepo(t.db),
    storage,
    network: { connection: () => Promise.resolve('wifi') },
    capability: capabilityFor(ram),
  });
  await render(
    <ThemeProvider scheme="light">
      <RepositoryProvider db={t.db} repos={createRepositories(t.db)}>
        <ModelsProvider manager={manager}>
          <ModelsScreen capability={capabilityFor(ram)} />
        </ModelsProvider>
      </RepositoryProvider>
    </ThemeProvider>,
  );
  return manager;
}

describe('ModelsScreen', () => {
  it('shows the device tier, models and their states', async () => {
    await renderScreen(8 * GIB);
    expect(screen.getByText(/Plus tier · 8 GB memory/)).toBeOnTheScreen();
    expect(screen.getByText('Not downloaded')).toBeOnTheScreen();
    expect(screen.getByText('Not available yet')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Download Pronunciation scoring')).toBeNull();
  });

  it('downloads a model and offers to delete it', async () => {
    const manager = await renderScreen(8 * GIB);
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Download Speech recognition'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByText('Ready, works offline')).toBeOnTheScreen();
    expect(manager.installedDir('stt')).toBe('file:///models/stt');
    // Deleting asks first; confirm with the dialog's destructive button.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Delete Speech recognition'));
      await Promise.resolve();
    });
    expect(alert).toHaveBeenCalledWith(
      'Delete Speech recognition?',
      expect.stringMatching(/download it again later/),
      expect.any(Array),
    );
    expect(await screen.findByText('Not downloaded')).toBeOnTheScreen();
  });

  it('marks models the phone cannot run', async () => {
    await renderScreen(2 * GIB);
    expect(screen.getByText('Needs a phone with more memory')).toBeOnTheScreen();
    expect(screen.getByText(/Basic tier/)).toBeOnTheScreen();
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(1500)).toBe('2 KB');
    expect(formatBytes(670_577_000)).toBe('671 MB');
    expect(formatBytes(1_234_000_000)).toBe('1.2 GB');
  });
});
