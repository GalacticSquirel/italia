/**
 * The on-device model manifest (`models/manifest.json` at the repository
 * root), validated with zod when the app loads it. See `models/README.md`.
 */
import { z } from 'zod';

import rawManifest from '../../../../models/manifest.json';

/** What a model does; providers look models up by kind. */
export const MODEL_KINDS = ['stt', 'phonemes', 'tts', 'llm', 'audio-pack'] as const;

/** A model kind. */
export type ModelKind = (typeof MODEL_KINDS)[number];

const FileSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9._-]+$/),
  url: z.url().startsWith('https://'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sizeBytes: z.number().int().positive(),
  verification: z.enum(['downloaded', 'published', 'built']),
  extract: z.literal('tar.bz2').optional(),
  available: z.boolean().optional(),
});

const ModelSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  kind: z.enum(MODEL_KINDS),
  title: z.string().min(1),
  description: z.string().min(1),
  licence: z.string().min(1),
  source: z.url().startsWith('https://'),
  minRamBytes: z.number().int().nonnegative(),
  rootDir: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
  files: z.array(FileSchema).min(1),
});

/** Zod schema of the manifest (format version 2). */
export const ManifestSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(2),
  models: z.array(ModelSchema),
});

/** One file of a model. */
export type ModelFileSpec = z.infer<typeof FileSchema>;
/** One model in the manifest. */
export type ModelSpec = z.infer<typeof ModelSchema>;
/** The whole manifest. */
export type Manifest = z.infer<typeof ManifestSchema>;

/** Parse and validate a manifest; throws a `ZodError` when it is malformed. */
export function parseManifest(input: unknown): Manifest {
  const manifest = ManifestSchema.parse(input);
  const ids = new Set<string>();
  for (const model of manifest.models) {
    if (ids.has(model.id)) throw new Error(`Duplicate model id: ${model.id}`);
    ids.add(model.id);
  }
  return manifest;
}

/** The manifest bundled with the app. */
export const MANIFEST: Manifest = parseManifest(rawManifest);

/** Total download size of a model. */
export function modelSizeBytes(model: ModelSpec): number {
  return model.files.reduce((sum, f) => sum + f.sizeBytes, 0);
}

/** Whether every file of a model has been published at its URL. */
export function isPublished(model: ModelSpec): boolean {
  return model.files.every((f) => f.available !== false);
}
