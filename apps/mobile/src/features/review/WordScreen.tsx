import { View } from 'react-native';

import { ListenButton } from '@/features/session/components/ListenButton';
import { posName } from '@/features/session/components/RecognitionCard';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { formatDays, formatDue, KIND_NAMES, percent, STATE_NAMES } from '@/features/study/format';
import { Button, Card, EmptyState, Screen, Stat, Text, useTheme } from '@/ui';

import { useWordDetail, type CardStats } from './useWordDetail';

function CardStatsCard({
  card,
  now,
  onToggle,
}: {
  card: CardStats;
  now: Date;
  onToggle: () => void;
}) {
  const { spacing } = useTheme();
  const started = card.state !== 'new';
  return (
    <Card>
      <Text variant="heading">{KIND_NAMES[card.kind]}</Text>
      <Text color="textMuted">
        {card.suspended ? 'Suspended' : `${STATE_NAMES[card.state]}${card.known ? ' · known' : ''}`}
      </Text>
      {started && card.kind !== 'recognition' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat label="Next review" value={formatDue(card.due, now)} />
          <Stat label="Stability" value={formatDays(card.stability)} />
          <Stat
            label="Recall now"
            value={card.retrievability === null ? '–' : percent(card.retrievability)}
          />
          <Stat
            label="Reviews"
            value={String(card.reps)}
            caption={`${String(card.lapses)} lapses`}
          />
        </View>
      ) : null}
      {card.kind === 'recognition' ? null : (
        <Button
          label={card.suspended ? 'Resume card' : 'Suspend card'}
          variant="secondary"
          accessibilityHint={
            card.suspended ? 'Brings the card back into reviews' : 'Stops the card being scheduled'
          }
          onPress={onToggle}
        />
      )}
    </Card>
  );
}

/** One word: meaning, example sentences, audio and its cards' memory stats. */
export function WordScreen({ lemmaId }: { lemmaId: number }) {
  const { detail, setSuspended } = useWordDetail(lemmaId);
  const speechRate = useSettingsStore((s) => s.settings.speechRate);
  const { spacing } = useTheme();
  if (!detail) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState title="Word not found" message="This word is not in the current content." />
      </Screen>
    );
  }
  const { lemma, now } = detail;
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card>
        <Text variant="display">{lemma.lemma}</Text>
        <Text color="textMuted">{`${posName(lemma.pos)} · rank ${String(lemma.freqRank)}`}</Text>
        <Text variant="heading">{lemma.glossEn}</Text>
        {detail.known ? <Text color="success">You know this word.</Text> : null}
      </Card>
      <ListenButton text={lemma.lemma} rate={speechRate} />
      {detail.sentences.length > 0 ? (
        <Card>
          <Text variant="heading">Examples</Text>
          {detail.sentences.map((s) => (
            <View key={s.id} style={{ gap: spacing.xxs, marginBottom: spacing.sm }}>
              <Text variant="bodyStrong">{s.it}</Text>
              <Text color="textMuted">{s.en}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {detail.cards.length === 0 ? (
        <EmptyState
          title="Not studied yet"
          message="This word will be introduced in a session when its turn comes."
        />
      ) : (
        detail.cards.map((c) => (
          <CardStatsCard
            key={c.id}
            card={c}
            now={now}
            onToggle={() => {
              setSuspended(c.id, !c.suspended);
            }}
          />
        ))
      )}
    </Screen>
  );
}
