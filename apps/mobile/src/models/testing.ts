/**
 * Test-only fakes for the model manager. Never import from app code.
 */
import type { DownloadOutcome, ModelStorage } from './modelManager';

const GIB = 1024 ** 3;

/** In-memory files; downloads complete when `release()` is called or immediately. */
export class FakeStorage implements ModelStorage {
  files = new Map<string, { size: number; sha: string }>();
  extracted: string[] = [];
  free: number | null = 10 * GIB;
  /** Content written by a download, per URL. */
  served = new Map<string, { size: number; sha: string }>();
  pending: { pause: () => void; finish: () => void; resumeData: string | null }[] = [];
  hold = false;
  modelDir = (id: string) => `file:///models/${id}`;
  join = (dir: string, name: string) => `${dir}/${name}`;
  ensureDir = () => Promise.resolve();
  fileSize = (uri: string) => Promise.resolve(this.files.get(uri)?.size ?? null);
  sha256 = (uri: string) => Promise.resolve(this.files.get(uri)?.sha ?? '');
  remove = (uri: string) => {
    for (const key of [...this.files.keys()]) if (key.startsWith(uri)) this.files.delete(key);
    return Promise.resolve();
  };
  extract = (archive: string, dir: string) => {
    this.extracted.push(`${archive}->${dir}`);
    return Promise.resolve();
  };
  freeBytes = () => Promise.resolve(this.free);
  download: ModelStorage['download'] = ({ url, destUri, resumeData, onProgress }) => {
    let settle!: (o: DownloadOutcome) => void;
    const result = new Promise<DownloadOutcome>((resolve) => {
      settle = resolve;
    });
    const finish = () => {
      const content = this.served.get(url) ?? { size: 0, sha: '' };
      onProgress(content.size);
      this.files.set(destUri, content);
      settle({ paused: false });
    };
    const entry = {
      resumeData,
      finish,
      pause: () => {
        onProgress(3);
        settle({ paused: true, resumeData: `resume:${url}` });
      },
    };
    this.pending.push(entry);
    if (!this.hold) queueMicrotask(finish);
    return { result, pause: entry.pause };
  };
}
