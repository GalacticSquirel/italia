import { act, render, screen, userEvent } from '@testing-library/react-native';

import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';
import type { AccountUser, AuthService } from '@/sync/auth';
import { SyncEngine } from '@/sync/SyncEngine';
import { SyncServicesProvider, type SyncServices } from '@/sync/SyncProvider';
import { FakeSyncServer } from '@/sync/testing/FakeSyncServer';
import { ThemeProvider } from '@/ui';

import { AccountSection } from './AccountSection';

function fakeAuth() {
  let user: AccountUser | null = null;
  let listener: ((u: AccountUser | null, event: 'SIGNED_IN' | 'SIGNED_OUT') => void) | null = null;
  const set = (next: AccountUser | null) => {
    user = next;
    listener?.(next, next ? 'SIGNED_IN' : 'SIGNED_OUT');
  };
  const auth: AuthService = {
    getUser: () => Promise.resolve(user),
    onChange: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
    sendEmailCode: jest.fn(() => Promise.resolve()),
    verifyEmailCode: jest.fn((email: string) => {
      set({ id: 'user-1', email });
      return Promise.resolve();
    }),
    completeFromUrl: () => Promise.resolve(false),
    signInWithIdToken: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => {
      set(null);
      return Promise.resolve();
    }),
  };
  return { auth, current: () => user };
}

let t: TestDatabase;

beforeEach(() => {
  t = createTestDatabase();
});

afterEach(() => {
  t.close();
});

async function renderWith(services: SyncServices | null) {
  await render(
    <ThemeProvider scheme="light">
      <SyncServicesProvider services={services}>
        <AccountSection />
      </SyncServicesProvider>
    </ThemeProvider>,
  );
}

describe('AccountSection', () => {
  it('explains that sync is off when the build has no Supabase config', async () => {
    await renderWith(null);
    expect(screen.getByText(/Sync is not set up/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });

  it('signs in with an emailed code, syncs, and signs out', async () => {
    const user = userEvent.setup();
    const { auth, current } = fakeAuth();
    const server = new FakeSyncServer();
    const engine = new SyncEngine({
      db: t.db,
      transport: server.transport(() => current()?.id ?? null),
      newId: () => 'device-test',
      yieldToUi: () => Promise.resolve(),
    });
    await renderWith({ engine, auth, redirectUrl: 'italia://auth-callback' });

    await user.type(screen.getByLabelText('Email address'), 'learner@example.com');
    await user.press(screen.getByRole('button', { name: 'Email me a sign-in code' }));
    expect(auth.sendEmailCode).toHaveBeenCalledWith(
      'learner@example.com',
      'italia://auth-callback',
    );

    await user.type(screen.getByLabelText('Code from the email'), '123456');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Signed in as learner@example.com.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByText('Last synced just now.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Email address')).toBeOnTheScreen();
    await act(() => Promise.resolve());
    engine.dispose();
  });
});
