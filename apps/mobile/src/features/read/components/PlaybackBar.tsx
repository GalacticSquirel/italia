import { View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

import type { PlaybackState } from '../playback/playbackController';

/** Speeds offered (0.75 to 1.25). */
export const SPEEDS = ['0.75', '0.9', '1', '1.1', '1.25'] as const;

/** Props for {@link PlaybackBar}. */
export interface PlaybackBarProps {
  state: PlaybackState;
  sentenceCount: number;
  onToggle: () => void;
  onRate: (rate: number) => void;
}

function playLabel(state: PlaybackState): string {
  switch (state.status) {
    case 'playing':
    case 'loading':
      return 'Pause';
    case 'paused':
    case 'error':
      return 'Resume';
    case 'ended':
      return 'Play again';
    case 'idle':
      return state.sentenceIndex > 0 ? 'Play from here' : 'Play story';
  }
}

/** What is speaking and where the highlighting comes from, said plainly. */
function voiceLine(state: PlaybackState): string | null {
  if (state.status === 'error') return `Playback stopped: ${state.error ?? 'unknown error'}`;
  if (state.voice === null) return null;
  const voice =
    state.voice === 'recorded'
      ? `Recorded audio${state.voiceName ? ` (${state.voiceName})` : ''}`
      : state.voice === 'neural'
        ? 'On-device neural voice'
        : 'Device voice';
  const timing =
    state.timing === 'engine'
      ? state.voice === 'recorded'
        ? 'words highlighted as they are said'
        : 'word highlighting from the voice'
      : 'word highlighting estimated from text length';
  const hint =
    state.voice === 'recorded'
      ? ''
      : ' · Download recorded audio in Settings, On-device models, for natural voices';
  return `${voice} · ${timing}${hint}`;
}

/**
 * Story playback controls: play or pause the whole story (from the current
 * sentence), the speed (one button that steps from 0.75 to 1.25), and an honest note on the voice and
 * on whether word highlighting is measured or estimated.
 */
export function PlaybackBar({ state, sentenceCount, onToggle, onRate }: PlaybackBarProps) {
  const { colors, spacing } = useTheme();
  const line = voiceLine(state);
  const speed = SPEEDS.find((s) => Number(s) === state.rate) ?? '1';
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
      testID="playback-bar"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flexGrow: 1 }}>
          <Button
            label={playLabel(state)}
            accessibilityHint="Plays the story aloud, sentence by sentence"
            onPress={onToggle}
          />
        </View>
        <Button
          label={`${speed}×`}
          variant="secondary"
          accessibilityLabel={`Playback speed ${speed} times`}
          accessibilityHint="Changes to the next speed, from 0.75 to 1.25"
          onPress={() => {
            onRate(Number(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]));
          }}
        />
        <Text
          variant="caption"
          color="textMuted"
          accessibilityLabel={`Sentence ${String(state.sentenceIndex + 1)} of ${String(sentenceCount)}`}
        >
          {`${String(state.sentenceIndex + 1)} / ${String(sentenceCount)}`}
        </Text>
      </View>
      {line ? (
        <Text
          variant="caption"
          color={state.status === 'error' ? 'danger' : 'textMuted'}
          accessibilityLiveRegion="polite"
        >
          {line}
        </Text>
      ) : null}
    </View>
  );
}
