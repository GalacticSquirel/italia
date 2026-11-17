/**
 * On-device model manager: the manifest, device capability tiers, resumable
 * checksum-verified downloads and their install state.
 */
export {
  capabilityFor,
  deviceCapability,
  TIER_DESCRIPTIONS,
  tierFor,
  type DeviceCapability,
  type DeviceTier,
} from './capability';
export {
  isPublished,
  MANIFEST,
  modelSizeBytes,
  parseManifest,
  type Manifest,
  type ModelKind,
  type ModelSpec,
} from './manifest';
export {
  InsufficientStorageError,
  ModelManager,
  NotOnWifiError,
  OfflineError,
  type ModelStatus,
  type ModelStorage,
  type ModelView,
  type NetworkInfo,
} from './modelManager';
export { ModelsProvider, useModelManager, useModels } from './ModelsContext';
export { uriToPath } from './nativeModelDeps';
