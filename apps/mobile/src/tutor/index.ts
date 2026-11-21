/**
 * The on-device tutor runtime: the conversation model on llama.rn behind the
 * `ConversationPartner` interface, model choice by device tier, and battery
 * and heat awareness.
 */
export { CONTEXT_TOKENS, contextParamsFor, fitTurns, MAX_REPLY_TOKENS } from './config';
export {
  createLlamaConversationPartner,
  type LlamaPartnerDeps,
  type TutorModelFile,
  type TutorPartner,
} from './llamaPartner';
export { tutorLog } from './log';
export { chooseTutorModel, type TutorModelChoice } from './modelChoice';
export { powerAdvice, type BatteryState, type PowerAdvice } from './power';
export {
  createNativeTutorPartner,
  TutorProvider,
  useTutor,
  useTutorModel,
  type TutorProviderProps,
} from './TutorContext';
