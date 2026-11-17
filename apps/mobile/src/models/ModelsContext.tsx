import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useRepositories } from '@/db';

import { deviceCapability } from './capability';
import { MANIFEST } from './manifest';
import { ModelManager, type ModelView } from './modelManager';
import { nativeModelStorage, nativeNetworkInfo } from './nativeModelDeps';

const ModelsContext = createContext<ModelManager | null>(null);

/** Props for {@link ModelsProvider}. */
export interface ModelsProviderProps {
  children: ReactNode;
  /** A manager to use instead of the native one (tests). */
  manager?: ModelManager;
}

/** Provides the app's {@link ModelManager}; render inside the database provider. */
export function ModelsProvider({ children, manager }: ModelsProviderProps) {
  const repos = useRepositories();
  const [value] = useState(
    () =>
      manager ??
      new ModelManager({
        manifest: MANIFEST,
        repo: repos.modelFiles,
        storage: nativeModelStorage,
        network: nativeNetworkInfo,
        capability: deviceCapability(),
      }),
  );
  return <ModelsContext.Provider value={value}>{children}</ModelsContext.Provider>;
}

/** The model manager. */
export function useModelManager(): ModelManager {
  const manager = useContext(ModelsContext);
  if (!manager) throw new Error('useModelManager must be used inside ModelsProvider');
  return manager;
}

/** Every model with its live install state. */
export function useModels(): readonly ModelView[] {
  const manager = useModelManager();
  return useSyncExternalStore(manager.subscribe, manager.getSnapshot);
}
