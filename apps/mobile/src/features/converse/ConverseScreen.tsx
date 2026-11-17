import { useState } from 'react';
import { View } from 'react-native';

import { SCENARIOS, scenariosForLevel, TUTOR_LEVELS, type TutorLevel } from '@italia/core';

import { useRepositories } from '@/db';
import { Card, ListItem, Screen, SegmentedControl, Text, useTheme } from '@/ui';

import { TutorModelGate } from './components/TutorModelGate';
import { loadLearnerProfile } from './learnerProfile';

/** Props for {@link ConverseScreen}. */
export interface ConverseScreenProps {
  onOpen: (scenarioId: string) => void;
  /** Clock (tests). */
  now?: () => Date;
}

/** Conversation: pick a role-play scenario at your level. */
export function ConverseScreen({ onOpen, now = () => new Date() }: ConverseScreenProps) {
  const repos = useRepositories();
  const { spacing } = useTheme();
  const [learnerLevel] = useState<TutorLevel>(() => loadLearnerProfile(repos, now()).level);
  const [level, setLevel] = useState<TutorLevel>(learnerLevel);
  const scenarios = scenariosForLevel(SCENARIOS, level);
  return (
    <Screen edges={['bottom', 'left', 'right']} testID="converse-screen">
      <TutorModelGate>
        <View style={{ gap: spacing.md }}>
          <Text color="textMuted">
            {`Role-play everyday scenes with a tutor that runs on this phone. It speaks at your level (${learnerLevel}), nudges you to fix mistakes, and turns its corrections into reviews.`}
          </Text>
          <SegmentedControl
            label="Level"
            options={TUTOR_LEVELS.map((l) => ({
              value: l,
              label: l === learnerLevel ? `${l} (you)` : l,
            }))}
            value={level}
            onChange={setLevel}
          />
          <Card>
            {scenarios.map((s) => (
              <ListItem
                key={s.id}
                title={s.title}
                subtitle={`${s.titleEn} · ${String(s.goals.length)} goals`}
                onPress={() => {
                  onOpen(s.id);
                }}
              />
            ))}
          </Card>
        </View>
      </TutorModelGate>
    </Screen>
  );
}
