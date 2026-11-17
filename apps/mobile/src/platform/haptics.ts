import * as Haptics from 'expo-haptics';

/** A short haptic for a correct or wrong answer. Failures (no haptics hardware) are ignored. */
export function answerHaptic(correct: boolean): void {
  Haptics.notificationAsync(
    correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => undefined);
}
