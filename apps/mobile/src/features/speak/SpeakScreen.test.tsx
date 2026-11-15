import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createModelFileRepo } from '@/data';
import { capabilityFor, MANIFEST, ModelManager, ModelsProvider } from '@/models';
import { FakeStorage } from '@/models/testing';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { SpeakScreen } from './SpeakScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('SpeakScreen', () => {
  it('links to each kind of speaking practice', async () => {
    const manager = new ModelManager({
      manifest: MANIFEST,
      repo: createModelFileRepo(app.t.db),
      storage: new FakeStorage(),
      network: { connection: () => Promise.resolve('wifi') },
      capability: capabilityFor(8 * 1024 ** 3),
    });
    const user = userEvent.setup();
    await render(
      app.wrap(
        <ModelsProvider manager={manager}>
          <SpeakScreen />
        </ModelsProvider>,
      ),
    );
    expect(screen.getByText(/Using your phone's own speech recognition/)).toBeOnTheScreen();
    await user.press(screen.getByText('Speaking drill'));
    expect(router.push).toHaveBeenLastCalledWith('/speak/drill');
    await user.press(screen.getByText('Hands-free drill'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/speak/drill',
      params: { handsFree: '1' },
    });
    await user.press(screen.getByText('Ear training'));
    expect(router.push).toHaveBeenLastCalledWith('/speak/ear');
    await user.press(screen.getByText('Shadowing'));
    expect(router.push).toHaveBeenLastCalledWith('/speak/shadow');
  });
});
