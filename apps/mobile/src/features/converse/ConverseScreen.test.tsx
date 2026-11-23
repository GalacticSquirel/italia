import { render, screen, userEvent } from '@testing-library/react-native';

import { createModelFileRepo } from '@/data';
import { capabilityFor, MANIFEST, ModelManager, ModelsProvider } from '@/models';
import { FakeStorage } from '@/models/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { ConverseScreen } from './ConverseScreen';

const GIB = 1024 ** 3;

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

function managerFor(memoryBytes: number, storage = new FakeStorage()) {
  return new ModelManager({
    manifest: MANIFEST,
    repo: createModelFileRepo(app.t.db),
    storage,
    network: { connection: () => Promise.resolve('wifi') },
    capability: capabilityFor(memoryBytes),
  });
}

async function renderWith(manager: ModelManager, onOpen = jest.fn()) {
  await render(
    app.wrap(
      <ModelsProvider manager={manager}>
        <ConverseScreen onOpen={onOpen} />
      </ModelsProvider>,
    ),
  );
  return onOpen;
}

describe('ConverseScreen', () => {
  it('offers the larger model, with its size, on a phone with plenty of memory', async () => {
    await renderWith(managerFor(12 * GIB));
    expect(screen.getByTestId('tutor-needs-download')).toBeOnTheScreen();
    expect(screen.getByText(/downloaded once \(4\.\d GB\)/)).toBeOnTheScreen();
    expect(screen.getByText('Conversation partner (larger)')).toBeOnTheScreen();
  });

  it('offers the larger model on a 12 GB phone that reports under 11 GiB', async () => {
    // A Galaxy S25+ reports about 10.6 GiB of its 12 GB.
    await renderWith(managerFor(10.6 * GIB));
    expect(screen.getByText('Conversation partner (larger)')).toBeOnTheScreen();
  });

  it('offers the smaller model on a mid-range phone', async () => {
    await renderWith(managerFor(7.3 * GIB));
    expect(screen.getByText('Conversation partner (smaller)')).toBeOnTheScreen();
    expect(screen.getByText(/downloaded once \(2\.\d GB\)/)).toBeOnTheScreen();
  });

  it('says honestly when the phone has too little memory', async () => {
    await renderWith(managerFor(4 * GIB));
    expect(screen.getByTestId('tutor-unsupported')).toBeOnTheScreen();
    expect(screen.getByText('Conversations need more memory')).toBeOnTheScreen();
    expect(screen.getByText(/needs at least 8 GB of memory/)).toBeOnTheScreen();
  });

  it('lists scenarios at the learner level once a model is installed', async () => {
    const storage = new FakeStorage();
    const spec = MANIFEST.models.find((m) => m.id === 'gemma-4-e2b-it-q4_0');
    const file = spec?.files[0];
    if (!spec || !file) throw new Error('manifest has no smaller conversation model');
    storage.served.set(file.url, { size: file.sizeBytes, sha: file.sha256 });
    const manager = managerFor(8 * GIB, storage);
    await manager.install(spec.id);
    const user = userEvent.setup();
    const onOpen = await renderWith(manager);
    expect(screen.getByText('A1 (you)')).toBeOnTheScreen();
    await user.press(screen.getByText('Colazione al bar'));
    expect(onOpen).toHaveBeenCalledWith('bar-colazione');
  });
});
