import { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { recordingClip, useSpeech } from '@/speech';
import { minTouchTarget, Text, useTheme } from '@/ui';

/** Presses shorter than this toggle recording instead of holding it. */
const HOLD_MS = 350;

type Phase = 'idle' | 'recording' | 'transcribing';

/**
 * Push-to-talk: hold to speak and release to send, or tap once to start and
 * again to stop (easier with a screen reader). The recording is transcribed
 * on the phone and handed to `onTranscript`.
 */
export function PushToTalk({
  disabled,
  onTranscript,
  onError,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const { recorder, stt, mic } = useSpeech();
  const { colors, radii, spacing } = useTheme();
  const [phase, setPhaseState] = useState<Phase>('idle');
  /** The phase as of the latest change (press handlers can outlive a render). */
  const phaseNow = useRef<Phase>('idle');
  const setPhase = (next: Phase) => {
    phaseNow.current = next;
    setPhaseState(next);
  };
  const pressedAt = useRef(0);
  /** Whether the current press is the one that started recording. */
  const startedByPress = useRef(false);

  const begin = async () => {
    let status = await mic.get();
    if (status !== 'granted') status = await mic.request();
    if (status !== 'granted') {
      onError('Allow the microphone in Settings to speak, or type your answer.');
      return;
    }
    try {
      await recorder.start();
      setPhase('recording');
    } catch {
      onError('The microphone could not start. Type your answer instead.');
    }
  };

  const finish = async () => {
    setPhase('transcribing');
    try {
      const recording = await recorder.stop();
      const transcript = await stt.transcribe(recordingClip(recording), { language: 'it' });
      const text = transcript.text.trim();
      if (text.length === 0) onError('I did not catch that. Try again, or type it.');
      else onTranscript(text);
    } catch {
      onError('Speech recognition failed. Try again, or type your answer.');
    } finally {
      setPhase('idle');
    }
  };

  const label =
    phase === 'recording' ? 'Stop and send' : phase === 'transcribing' ? 'Listening…' : 'Speak';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={phase === 'recording' ? 'Stop recording and send' : 'Speak your answer'}
      accessibilityHint="Hold to talk, or tap to start and tap again to stop"
      accessibilityState={{
        disabled: disabled || phase === 'transcribing',
        busy: phase !== 'idle',
      }}
      disabled={disabled || phase === 'transcribing'}
      onPressIn={() => {
        pressedAt.current = Date.now();
        startedByPress.current = phaseNow.current === 'idle';
        if (startedByPress.current) void begin();
      }}
      onPressOut={() => {
        const held = Date.now() - pressedAt.current >= HOLD_MS;
        // Releasing a hold sends; releasing a quick tap keeps recording.
        if (phaseNow.current === 'recording' && held && startedByPress.current) void finish();
      }}
      onPress={() => {
        // A tap while recording (started by an earlier tap) stops it.
        if (phaseNow.current === 'recording' && !startedByPress.current) void finish();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          backgroundColor:
            phase === 'recording'
              ? colors.danger
              : pressed
                ? colors.primaryPressed
                : colors.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      testID="push-to-talk"
    >
      <Text variant="label" color="onPrimary">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
