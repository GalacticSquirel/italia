/**
 * Downloads, verifies and tracks on-device models listed in the manifest.
 *
 * Generic over model kinds: speech recognition, pronunciation, voices and
 * (later) the conversation model all install the same way. Each file is
 * downloaded resumably into the model's install folder, its size and SHA-256
 * are checked against the manifest before it is marked `installed`, archives
 * are unpacked after verification, and progress is kept in SQLite
 * (`model_file`) so a download interrupted by the app closing resumes later.
 *
 * Native work (files, network, archives) sits behind {@link ModelStorage} and
 * {@link NetworkInfo}, so the logic here is tested with fakes.
 */
import type { ModelFileRepo, ModelFileRow } from '@/data/ModelFileRepo';

import type { DeviceCapability } from './capability';
import { isPublished, type Manifest, type ModelKind, type ModelSpec } from './manifest';

/** Outcome of a download job. */
export type DownloadOutcome = { paused: false } | { paused: true; resumeData: string | null };

/** A running download. */
export interface DownloadJob {
  /** Settles when the download completes or is paused; rejects on failure. */
  result: Promise<DownloadOutcome>;
  /** Pause; `result` then resolves with resume data. */
  pause(): void;
}

/** File operations the manager needs (expo-file-system and sherpa-onnx in the app). */
export interface ModelStorage {
  /** URI of a model's install folder. */
  modelDir(modelId: string): string;
  /** URI of a file inside a folder. */
  join(dir: string, name: string): string;
  ensureDir(uri: string): Promise<void>;
  /** Size of a file in bytes, or null when it does not exist. */
  fileSize(uri: string): Promise<number | null>;
  /** Lowercase hex SHA-256 of a file. */
  sha256(uri: string): Promise<string>;
  /** Delete a file or folder (no error when missing). */
  remove(uri: string): Promise<void>;
  /** Unpack an archive into a folder. */
  extract(archiveUri: string, dirUri: string): Promise<void>;
  /** Free space in bytes, or null when unknown. */
  freeBytes(): Promise<number | null>;
  download(request: {
    url: string;
    destUri: string;
    resumeData: string | null;
    onProgress: (bytesWritten: number) => void;
  }): DownloadJob;
}

/** Current connection type. */
export type ConnectionType = 'wifi' | 'cellular' | 'other' | 'none';

/** Network state the manager needs (expo-network in the app). */
export interface NetworkInfo {
  connection(): Promise<ConnectionType>;
}

/** Thrown by {@link ModelManager.install} on mobile data unless allowed. */
export class NotOnWifiError extends Error {
  constructor() {
    super('Connect to Wi-Fi to download models, or allow mobile data.');
    this.name = 'NotOnWifiError';
  }
}

/** Thrown when there is no connection. */
export class OfflineError extends Error {
  constructor() {
    super('You are offline. Connect to download models.');
    this.name = 'OfflineError';
  }
}

/** Thrown when the phone does not have room for the download. */
export class InsufficientStorageError extends Error {
  constructor(readonly neededBytes: number) {
    super('Not enough free storage for this model.');
    this.name = 'InsufficientStorageError';
  }
}

/** Status of a model as shown to the learner. */
export type ModelStatus =
  | 'not_installed'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'installed'
  | 'failed'
  /** Not published yet (`available: false` in the manifest). */
  | 'unavailable'
  /** The device has less RAM than the model needs. */
  | 'unsupported';

/** A model with its install state. */
export interface ModelView {
  spec: ModelSpec;
  status: ModelStatus;
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
}

/** Dependencies of {@link ModelManager}. */
export interface ModelManagerDeps {
  manifest: Manifest;
  repo: ModelFileRepo;
  storage: ModelStorage;
  network: NetworkInfo;
  capability: DeviceCapability;
}

/** Room kept free on top of a download, so the phone does not fill up. */
export const STORAGE_HEADROOM_BYTES = 200 * 1024 ** 2;

const isCurrent = (row: ModelFileRow | undefined, sha256: string): row is ModelFileRow =>
  row?.sha256 === sha256;

/** See the module documentation. */
export class ModelManager {
  private readonly listeners = new Set<() => void>();
  private readonly jobs = new Map<string, DownloadJob>();
  /** Live byte counts of running downloads, by `modelId/name`. */
  private readonly live = new Map<string, number>();
  private readonly installing = new Set<string>();
  private snapshot: readonly ModelView[] = [];

  constructor(private readonly deps: ModelManagerDeps) {
    this.recover();
    this.refresh();
  }

  /** Subscribe to changes; returns the unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Every model in the manifest with its state (stable until the next change). */
  getSnapshot = (): readonly ModelView[] => this.snapshot;

  /** One model's state. */
  view(modelId: string): ModelView | undefined {
    return this.snapshot.find((m) => m.spec.id === modelId);
  }

  /** The folder holding an installed model (its `rootDir` for archives), or null. */
  installedDir(modelId: string): string | null {
    const view = this.view(modelId);
    if (view?.status !== 'installed') return null;
    const dir = this.deps.storage.modelDir(modelId);
    return view.spec.rootDir === undefined ? dir : this.deps.storage.join(dir, view.spec.rootDir);
  }

  /** The first installed model of a kind, with its folder. */
  installedOfKind(kind: ModelKind): { spec: ModelSpec; dir: string } | null {
    for (const view of this.snapshot) {
      if (view.spec.kind !== kind) continue;
      const dir = this.installedDir(view.spec.id);
      if (dir !== null) return { spec: view.spec, dir };
    }
    return null;
  }

  /** Bytes used by installed and partly downloaded models. */
  storageUsedBytes(): number {
    return this.snapshot.reduce((sum, m) => sum + m.bytesDone, 0);
  }

  /**
   * Download, verify and install a model. Resolves when it is installed or
   * paused; rejects (and marks the file `failed`) on errors.
   *
   * @throws NotOnWifiError on mobile data unless `allowCellular`
   * @throws OfflineError with no connection
   * @throws InsufficientStorageError when the files would not fit
   */
  async install(modelId: string, options: { allowCellular?: boolean } = {}): Promise<void> {
    const spec = this.spec(modelId);
    if (this.installing.has(modelId)) return;
    const view = this.view(modelId);
    if (view?.status === 'unavailable' || view?.status === 'unsupported') {
      throw new Error(`${spec.title} cannot be installed on this device yet.`);
    }
    const connection = await this.deps.network.connection();
    if (connection === 'none') throw new OfflineError();
    if (connection !== 'wifi' && options.allowCellular !== true) throw new NotOnWifiError();

    const rows = this.rows(modelId);
    const remaining = spec.files.filter(
      (f) => !(isCurrent(rows.get(f.name), f.sha256) && rows.get(f.name)?.status === 'installed'),
    );
    const needed =
      remaining.reduce(
        (sum, f) =>
          sum +
          (f.sizeBytes -
            (isCurrent(rows.get(f.name), f.sha256) ? (rows.get(f.name)?.bytesDone ?? 0) : 0)) *
            (f.extract === undefined ? 1 : 2),
        0,
      ) + STORAGE_HEADROOM_BYTES;
    const free = await this.deps.storage.freeBytes();
    if (free !== null && free < needed) throw new InsufficientStorageError(needed);

    this.installing.add(modelId);
    try {
      const dir = this.deps.storage.modelDir(modelId);
      await this.deps.storage.ensureDir(dir);
      for (const file of remaining) {
        const done = await this.installFile(spec, file.name, dir);
        if (!done) return; // paused
      }
    } finally {
      this.installing.delete(modelId);
      this.refresh();
    }
  }

  /** Pause a running download of a model. */
  pause(modelId: string): void {
    for (const [key, job] of this.jobs) {
      if (key.startsWith(`${modelId}/`)) job.pause();
    }
  }

  /** Delete a model's files and state. */
  async remove(modelId: string): Promise<void> {
    this.pause(modelId);
    await this.deps.storage.remove(this.deps.storage.modelDir(modelId));
    this.deps.repo.removeModel(modelId);
    this.refresh();
  }

  // -------------------------------------------------------------------------

  private spec(modelId: string): ModelSpec {
    const spec = this.deps.manifest.models.find((m) => m.id === modelId);
    if (!spec) throw new Error(`Unknown model: ${modelId}`);
    return spec;
  }

  private rows(modelId: string): Map<string, ModelFileRow> {
    return new Map(this.deps.repo.list(modelId).map((r) => [r.name, r]));
  }

  /** Downloads interrupted by the app closing are paused, not running. */
  private recover(): void {
    for (const row of this.deps.repo.list()) {
      if (row.status === 'downloading' || row.status === 'verifying') {
        this.deps.repo.put({
          ...row,
          status: row.status === 'verifying' ? 'downloaded' : 'paused',
        });
      }
    }
  }

  /** @returns false when the download was paused */
  private async installFile(spec: ModelSpec, name: string, dir: string): Promise<boolean> {
    const file = spec.files.find((f) => f.name === name);
    if (!file) throw new Error(`Unknown file ${name} of ${spec.id}`);
    const { storage, repo } = this.deps;
    const uri = storage.join(dir, file.name);
    const key = `${spec.id}/${file.name}`;
    const existing = this.rows(spec.id).get(file.name);
    const current = isCurrent(existing, file.sha256) ? existing : undefined;
    if (existing && !current) await storage.remove(uri); // the manifest changed
    const base = { modelId: spec.id, name: file.name, sha256: file.sha256, error: null };

    try {
      if (current?.status !== 'downloaded') {
        repo.put({
          ...base,
          status: 'downloading',
          bytesDone: current?.bytesDone ?? 0,
          resumeData: current?.resumeData ?? null,
        });
        this.refresh();
        const job = storage.download({
          url: file.url,
          destUri: uri,
          resumeData: current?.resumeData ?? null,
          onProgress: (bytes) => {
            this.live.set(key, bytes);
            this.refresh();
          },
        });
        this.jobs.set(key, job);
        let outcome: DownloadOutcome;
        try {
          outcome = await job.result;
        } finally {
          this.jobs.delete(key);
        }
        const bytesDone = this.live.get(key) ?? current?.bytesDone ?? 0;
        this.live.delete(key);
        if (outcome.paused) {
          repo.put({ ...base, status: 'paused', bytesDone, resumeData: outcome.resumeData });
          return false;
        }
        repo.put({ ...base, status: 'downloaded', bytesDone: file.sizeBytes, resumeData: null });
      }

      repo.put({ ...base, status: 'verifying', bytesDone: file.sizeBytes, resumeData: null });
      this.refresh();
      const size = await storage.fileSize(uri);
      if (size !== file.sizeBytes) {
        throw new Error(
          `${file.name} is ${String(size ?? 0)} bytes, expected ${String(file.sizeBytes)}.`,
        );
      }
      const hash = (await storage.sha256(uri)).toLowerCase();
      if (hash !== file.sha256) throw new Error(`${file.name} failed its checksum.`);
      if (file.extract !== undefined) {
        await storage.extract(uri, dir);
        await storage.remove(uri);
      }
      repo.put({ ...base, status: 'installed', bytesDone: file.sizeBytes, resumeData: null });
      return true;
    } catch (e) {
      this.live.delete(key);
      await storage.remove(uri).catch(() => undefined);
      repo.put({
        ...base,
        status: 'failed',
        bytesDone: 0,
        resumeData: null,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    } finally {
      this.refresh();
    }
  }

  private refresh(): void {
    const all = this.deps.repo.list();
    this.snapshot = this.deps.manifest.models.map((spec) => this.viewOf(spec, all));
    for (const listener of [...this.listeners]) listener();
  }

  private viewOf(spec: ModelSpec, all: readonly ModelFileRow[]): ModelView {
    const rows = new Map(all.filter((r) => r.modelId === spec.id).map((r) => [r.name, r]));
    const bytesTotal = spec.files.reduce((s, f) => s + f.sizeBytes, 0);
    let bytesDone = 0;
    let installed = 0;
    let error: string | null = null;
    const statuses = new Set<string>();
    for (const file of spec.files) {
      const row = rows.get(file.name);
      const live = this.live.get(`${spec.id}/${file.name}`);
      if (!isCurrent(row, file.sha256)) {
        statuses.add('none');
        continue;
      }
      bytesDone += live ?? row.bytesDone;
      statuses.add(row.status);
      if (row.status === 'installed') installed += 1;
      if (row.status === 'failed') error = row.error;
    }
    let status: ModelStatus;
    if (installed === spec.files.length) status = 'installed';
    else if (statuses.has('verifying')) status = 'verifying';
    else if (statuses.has('downloading') || this.installing.has(spec.id)) status = 'downloading';
    else if (statuses.has('failed')) status = 'failed';
    else if (statuses.has('paused') || statuses.has('downloaded') || installed > 0)
      status = 'paused';
    else if (!isPublished(spec)) status = 'unavailable';
    else if (!this.deps.capability.canRun(spec.minRamBytes)) status = 'unsupported';
    else status = 'not_installed';
    return { spec, status, bytesDone, bytesTotal, error };
  }
}
