export type { AudioOut, SpeakOptions } from './audio/audioOut';
export { recordingClip, type Recorder, type Recording } from './audio/recorder';
export { envelope, MODEL_SAMPLE_RATE } from './pcm';
export type { MicPermissions, MicStatus } from './permissions';
export type { PronunciationAnalysis, WordFeedback } from './pronunciation/analyse';
export { feedbackText } from './pronunciation/feedbackText';
export {
  createNativeSpeechServices,
  SpeechProvider,
  useSpeech,
  type SpeechProviderProps,
  type SpeechServices,
} from './SpeechContext';
export { ENGLISH, ITALIAN, sayEnglish, sayItalian } from './voice';
