import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { useRepositories } from '@/db';

import {
  createSessionStore,
  type SessionActions,
  type SessionState,
  type SessionStore,
} from './sessionStore';

const SessionContext = createContext<SessionStore | null>(null);

/** Props for {@link SessionProvider}. */
export interface SessionProviderProps {
  children: ReactNode;
  /** A ready-made store (tests); by default one is created for this session. */
  store?: SessionStore;
}

/** Holds the store of one study session for the screens inside it. */
export function SessionProvider({ children, store }: SessionProviderProps) {
  const repos = useRepositories();
  const [own] = useState(() => store ?? createSessionStore({ repos }));
  return <SessionContext value={own}>{children}</SessionContext>;
}

/** The running session's store. */
export function useSessionStore(): SessionStore {
  const store = useContext(SessionContext);
  if (!store) throw new Error('useSession must be used inside SessionProvider');
  return store;
}

/** Select from the running session's state. */
export function useSession<T>(selector: (state: SessionState & SessionActions) => T): T {
  return useStore(useSessionStore(), selector);
}
