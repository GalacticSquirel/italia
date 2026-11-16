/**
 * Which conversation model to use on this phone. Every `llm` model in the
 * manifest is a tutor candidate, larger first; the phone gets the first one
 * its memory allows (`minRamBytes`, see the device tiers). A fine-tuned GGUF
 * replaces a base model by taking its manifest entry.
 */
import { modelSizeBytes, type ModelView } from '@/models';

/** The tutor model state for this phone. */
export type TutorModelChoice =
  /** A model is installed and can be loaded. */
  | { state: 'ready'; model: ModelView }
  /** The recommended model is not (fully) downloaded; `model.status` says how far it is. */
  | { state: 'needs_download'; model: ModelView; sizeBytes: number }
  /** No conversation model is published yet. */
  | { state: 'unavailable' }
  /** The phone has too little memory for any conversation model. */
  | { state: 'unsupported'; minRamBytes: number | null };

/** Choose the tutor model from the model manager's views (manifest order). */
export function chooseTutorModel(views: readonly ModelView[]): TutorModelChoice {
  const llms = views.filter((v) => v.spec.kind === 'llm');
  const runnable = llms.filter((v) => v.status !== 'unsupported');
  const installed = runnable.find((v) => v.status === 'installed');
  if (installed) return { state: 'ready', model: installed };
  if (llms.length > 0 && runnable.length === 0) {
    return { state: 'unsupported', minRamBytes: Math.min(...llms.map((v) => v.spec.minRamBytes)) };
  }
  // Prefer a download already under way, then the largest model the phone can run.
  const started = runnable.find((v) =>
    ['downloading', 'paused', 'verifying', 'failed'].includes(v.status),
  );
  const recommended = started ?? runnable.find((v) => v.status === 'not_installed');
  if (recommended) {
    return {
      state: 'needs_download',
      model: recommended,
      sizeBytes: modelSizeBytes(recommended.spec),
    };
  }
  return { state: 'unavailable' };
}
