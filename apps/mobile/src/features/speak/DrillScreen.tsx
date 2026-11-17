import { useState } from 'react';
import { View } from 'react-native';

import { useRepositories } from '@/db';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { Button, EmptyState, Screen, Text, useTheme } from '@/ui';

import { DrillView } from './components/DrillView';
import { MicGate } from './components/MicGate';
import { loadSpeakingDrill, type SpeakingDrill } from './drill/drillData';
import type { DrillOutcome } from './drill/drillMachine';
import { useDrillRunner } from './drill/useDrillRunner';
import { useHandsFree } from './useHandsFree';

export interface DrillScreenProps {
  /** Audio-only: no taps needed, screen kept awake. */
  handsFree?: boolean;
  onClose: () => void;
  /** Clock (tests). */
  now?: () => Date;
}

function Summary({
  outcomes,
  onClose,
}: {
  outcomes: readonly DrillOutcome[];
  onClose: () => void;
}) {
  const right = outcomes.filter((o) => o.rating !== 'again').length;
  return (
    <EmptyState
      title="Drill complete"
      message={`${String(right)} of ${String(outcomes.length)} right first time. Your answers are saved.`}
      action={<Button label="Done" onPress={onClose} />}
    />
  );
}

function Runner({
  drill,
  handsFree,
  onClose,
  now,
}: {
  drill: SpeakingDrill;
  handsFree: boolean;
  onClose: () => void;
  now: () => Date;
}) {
  const { spacing } = useTheme();
  const rate = useSettingsStore((s) => s.settings.speechRate);
  const [finished, setFinished] = useState<readonly DrillOutcome[] | null>(null);
  useHandsFree(handsFree);
  const runner = useDrillRunner({
    items: drill.items,
    rate,
    handsFree,
    onOutcome: (outcome) => {
      drill.record(outcome, now());
    },
    onFinished: setFinished,
  });
  if (finished) return <Summary outcomes={finished} onClose={onClose} />;
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="caption" color="textMuted">
        {`${String(Math.min(runner.state.index + 1, drill.items.length))} of ${String(drill.items.length)}${handsFree ? ' · hands-free' : ''}`}
      </Text>
      <DrillView runner={runner} />
    </View>
  );
}

/** Pimsleur-style speaking drill over today's spoken prompts. */
export function DrillScreen({
  handsFree = false,
  onClose,
  now = () => new Date(),
}: DrillScreenProps) {
  const repos = useRepositories();
  const [drill] = useState(() => loadSpeakingDrill(repos, now()));
  return (
    <Screen edges={['bottom', 'left', 'right']} testID="drill-screen">
      {drill.items.length === 0 ? (
        <EmptyState
          title="Nothing to say yet"
          message="Speaking prompts are made from sentences whose words you already know. Learn a few words in today's session, then come back."
          action={<Button label="Close" onPress={onClose} />}
        />
      ) : (
        <MicGate>
          <Runner drill={drill} handsFree={handsFree} onClose={onClose} now={now} />
        </MicGate>
      )}
    </Screen>
  );
}
