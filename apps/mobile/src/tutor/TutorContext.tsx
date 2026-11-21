/**
 * Provides the on-device tutor to the conversation screens. The native
 * partner loads the conversation model the model manager has installed, and
 * frees it when the app goes to the background, on a memory warning, and when
 * the conversation screens close (this provider unmounts).
 */
import { Directory, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { uriToPath, useModelManager, useModels, type ModelManager } from '@/models';

import { readBattery } from './battery';
import { createLlamaConversationPartner, type TutorPartner } from './llamaPartner';
import { tutorLog } from './log';
import { chooseTutorModel, type TutorModelChoice } from './modelChoice';
import { nativeLlamaRuntime } from './nativeLlama';

const TutorContext = createContext<TutorPartner | null>(null);

/** Folder for saved prompt caches (in the cache directory: the OS may clear it). */
function stateDir(): string {
  const dir = new Directory(Paths.cache, 'tutor-state');
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    // Without the folder, prompt caches are simply not saved.
  }
  return uriToPath(dir.uri);
}

/** The native tutor partner over the model manager. */
export function createNativeTutorPartner(models: ModelManager): TutorPartner {
  const choice = () => chooseTutorModel(models.getSnapshot());
  return createLlamaConversationPartner({
    runtime: nativeLlamaRuntime,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    model() {
      const current = choice();
      if (current.state !== 'ready') return null;
      const dir = models.installedDir(current.model.spec.id);
      const file = current.model.spec.files[0];
      if (dir === null || !file) return null;
      return { id: current.model.spec.id, path: uriToPath(`${dir}/${file.name}`) };
    },
    availability() {
      const current = choice();
      if (current.state === 'ready') return Promise.resolve('ready');
      if (current.state === 'needs_download') return Promise.resolve('needs_download');
      return Promise.resolve('unsupported');
    },
    stateDir: stateDir(),
    battery: readBattery,
    log: tutorLog,
  });
}

function NativeTutorProvider({ children }: { children: ReactNode }) {
  const models = useModelManager();
  const [partner] = useState(() => createNativeTutorPartner(models));
  return <TutorLifecycle partner={partner}>{children}</TutorLifecycle>;
}

function TutorLifecycle({ partner, children }: { partner: TutorPartner; children: ReactNode }) {
  useEffect(() => {
    const free = () => {
      void partner.unload().catch(() => undefined);
    };
    const change = AppState.addEventListener('change', (state) => {
      if (state === 'background') free();
    });
    const memory = AppState.addEventListener('memoryWarning', free);
    return () => {
      change.remove();
      memory.remove();
      free();
    };
  }, [partner]);
  return <TutorContext.Provider value={partner}>{children}</TutorContext.Provider>;
}

/** Props for {@link TutorProvider}. */
export interface TutorProviderProps {
  children: ReactNode;
  /** A partner to use instead of the native one (tests). */
  partner?: TutorPartner;
}

/** Provides the tutor; render inside `ModelsProvider`. */
export function TutorProvider({ children, partner }: TutorProviderProps) {
  if (partner) return <TutorLifecycle partner={partner}>{children}</TutorLifecycle>;
  return <NativeTutorProvider>{children}</NativeTutorProvider>;
}

/** The tutor partner. */
export function useTutor(): TutorPartner {
  const partner = useContext(TutorContext);
  if (!partner) throw new Error('useTutor must be used inside TutorProvider');
  return partner;
}

/** The conversation model state on this phone, live. */
export function useTutorModel(): TutorModelChoice {
  return chooseTutorModel(useModels());
}
