/**
 * Native implementations of the model manager's {@link ModelStorage} and
 * {@link NetworkInfo}: expo-file-system for files, resumable downloads and
 * SHA-256, expo-network for the connection type, and sherpa-onnx's archive
 * extraction (libarchive) for `.tar.bz2` models.
 */
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';

import type { ConnectionType, DownloadJob, ModelStorage, NetworkInfo } from './modelManager';

/** Folder under the app's documents that holds every model. */
export const MODELS_DIR = 'models';

/** A file URI as a plain path, for native libraries that take paths. */
export function uriToPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

interface Digestible {
  digest(algorithm: 'SHA-256'): Promise<string>;
}

function startDownload(request: Parameters<ModelStorage['download']>[0]): DownloadJob {
  const onProgress = ({ bytesWritten }: { bytesWritten: number }) => {
    request.onProgress(bytesWritten);
  };
  const task =
    request.resumeData === null
      ? File.createDownloadTask(request.url, new File(request.destUri), { onProgress })
      : DownloadTask.fromSavable(
          JSON.parse(request.resumeData) as ReturnType<DownloadTask['savable']>,
          { onProgress },
        );
  const state = { pauseRequested: false };
  const result = (async () => {
    const file =
      request.resumeData === null ? await task.downloadAsync() : await task.resumeAsync();
    if (file === null || state.pauseRequested) {
      return { paused: true as const, resumeData: JSON.stringify(task.savable()) };
    }
    return { paused: false as const };
  })().finally(() => {
    if (!state.pauseRequested) task.release();
  });
  return {
    result,
    pause() {
      state.pauseRequested = true;
      task.pause();
    },
  };
}

/** Model storage in `<documents>/models/<id>`. */
export const nativeModelStorage: ModelStorage = {
  modelDir: (modelId) => new Directory(Paths.document, MODELS_DIR, modelId).uri,
  join: (dir, name) => `${dir.replace(/\/$/, '')}/${name}`,
  ensureDir(uri) {
    new Directory(uri).create({ intermediates: true, idempotent: true });
    return Promise.resolve();
  },
  fileSize(uri) {
    const file = new File(uri);
    return Promise.resolve(file.exists ? file.size : null);
  },
  sha256(uri) {
    // The native digest streams the file in 64 KiB chunks (Android and iOS).
    return (new File(uri) as unknown as Digestible).digest('SHA-256');
  },
  remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
    else {
      const dir = new Directory(uri);
      if (dir.exists) dir.delete();
    }
    return Promise.resolve();
  },
  async writeText(uri, text) {
    await new File(uri).write(text);
  },
  async extract(archiveUri, dirUri) {
    const archivePath = uriToPath(archiveUri);
    const result = await extractArchive(
      {
        modelId: archivePath.split('/').pop() ?? 'model',
        archivePath,
        format: 'tar.bz2',
      },
      uriToPath(dirUri),
      { force: true },
    );
    if (!result.success) throw new Error(result.reason ?? 'Could not unpack the model.');
  },
  freeBytes: () => Promise.resolve(Paths.availableDiskSpace),
  download: startDownload,
};

/** Connection type from expo-network. */
export const nativeNetworkInfo: NetworkInfo = {
  async connection(): Promise<ConnectionType> {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return 'none';
    switch (state.type) {
      case Network.NetworkStateType.WIFI:
      case Network.NetworkStateType.ETHERNET:
        return 'wifi';
      case Network.NetworkStateType.CELLULAR:
        return 'cellular';
      case Network.NetworkStateType.NONE:
        return 'none';
      default:
        return 'other';
    }
  },
};
