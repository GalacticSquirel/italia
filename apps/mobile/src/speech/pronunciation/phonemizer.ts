/**
 * The Italian phoneme recognizer's output labels and decoder settings
 * (wav2vec2 Italian phonemizer, see `models/manifest.json`). The label order
 * is the checkpoint's `vocab.json` plus `added_tokens.json` at the pinned
 * revision; `[PAD]` is the CTC blank.
 */
import type { CtcConfig } from './ctc';

/** Output labels by index (39). */
export const PHONEMIZER_LABELS: readonly string[] = [
  '|',
  'a',
  'b',
  'd',
  'e',
  'f',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'z',
  'ŋ',
  'ɔ',
  'ɛ',
  'ɡ',
  'ɪ',
  'ɲ',
  'ɾ',
  'ʃ',
  'ʊ',
  'ʎ',
  'ʒ',
  'ː',
  '̪',
  '[UNK]',
  '[PAD]',
  '<s>',
  '</s>',
];

/** One output frame per 320 input samples at 16 kHz. */
export const PHONEMIZER_FRAME_MS = 20;

/** Decoder settings for the phonemizer. */
export const PHONEMIZER_CTC: CtcConfig = {
  labels: PHONEMIZER_LABELS,
  blank: 36,
  wordDelimiter: 0,
  frameMs: PHONEMIZER_FRAME_MS,
  modifiers: ['ː'],
  // Dental marks are the Italian default; special tokens are never phones.
  dropLabels: ['̪', '[UNK]', '<s>', '</s>'],
  // The model spells affricates as two labels.
  merges: { tʃ: 'tʃ', dʒ: 'dʒ', ts: 'ts', dz: 'dz' },
};
