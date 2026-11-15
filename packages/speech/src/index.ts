/**
 * `@italia/speech`: the deterministic parts of Italia's on-device pronunciation
 * scorer, in pure TypeScript.
 *
 * - {@link g2p}: Italian spelling to phonemes, with stress, syllables and source spans.
 * - {@link scorePronunciation}: aligns expected phonemes with a CTC phoneme
 *   recognizer's output and computes GOP-style phone, word and utterance scores.
 * - {@link checkGeminates}, {@link checkStress}, {@link checkSegmentals}: targeted
 *   checks that return i18n feedback keys.
 * - {@link MINIMAL_PAIRS}: curated minimal pairs for ear training.
 *
 * No audio I/O or ML runtime lives here, and nothing may import React, React
 * Native or Expo.
 *
 * @packageDocumentation
 */

export {
  alignPhones,
  INSERTION_WEIGHT,
  isAcceptable,
  MIN_POSTERIOR,
  phoneScoreFromLogPosterior,
  prepareSegments,
  scorePronunciation,
  ZERO_SCORE_POSTERIOR,
  type AlignmentStep,
  type PhoneScore,
  type PronunciationScore,
  type RecognizedPhone,
  type RecognizedSegment,
  type WordScore,
} from './align';
export {
  ASPIRATION_VOT_MS,
  checkGeminates,
  checkSegmentals,
  checkStress,
  FEEDBACK_KEYS,
  REDUCED_VOWELS,
  STRESS_CUE_WEIGHTS,
  STRESS_FINAL_LENGTHENING,
  syllableProsodyFromScore,
  type Feedback,
  type FeedbackKey,
  type GeminateCheck,
  type GeminateOptions,
  type GeminateVerdict,
  type SegmentalIssue,
  type SegmentalIssueKind,
  type StressCheck,
  type StressOptions,
  type StressVerdict,
  type SyllableProsody,
} from './checks';
export {
  expectedPhones,
  g2p,
  type ExpectedPhone,
  type G2PResult,
  type MidVowelSource,
  type PhoneFlag,
  type PhoneRole,
  type PhoneToken,
  type StressSource,
  type Syllable,
  type TextSpan,
  type WordG2P,
} from './g2p';
export {
  FEATURES,
  FOREIGN_SYMBOLS,
  INDEL_COST,
  INTRINSIC_GEMINATES,
  isConsonant,
  isGlide,
  isPhoneme,
  isVowel,
  NON_SPEECH_SYMBOLS,
  normalizePhone,
  PHONEMES,
  PLACES,
  recognizedCost,
  substitutionCost,
  type ConsonantFeatures,
  type Manner,
  type NormalizedPhone,
  type Phoneme,
  type PhonemeFeatures,
  type Place,
  type RecognizedSymbol,
  type VowelFeatures,
  type VowelHeight,
} from './inventory';
export {
  LEXICON,
  LEXICON_LIST_SIZES,
  lookupLexicon,
  stripAnnotation,
  type LexiconEntry,
  type ZValue,
} from './lexicon';
export {
  MINIMAL_PAIRS,
  minimalPairsFor,
  type MinimalPairContrast,
  type MinimalPairItem,
  type MinimalPairSet,
  type SecondaryDifference,
} from './minimalPairs';
