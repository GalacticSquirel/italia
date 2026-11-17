import { ScrollView, View } from 'react-native';

import { diffStrings, ERROR_TAG_BY_ID, type ConversationSummary } from '@italia/core';

import { DiffText } from '@/features/session/components/DiffText';
import { Button, Card, Stat, Text, useTheme } from '@/ui';

/** The end-of-conversation summary. */
export function ConversationSummaryView({
  summary,
  cardsAdded,
  onDone,
}: {
  summary: ConversationSummary;
  /** Review cards made from this conversation's corrections. */
  cardsAdded: number;
  onDone: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }} testID="summary">
      <Text variant="title">Conversation summary</Text>
      <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
        <Stat
          label="Goals"
          value={`${String(summary.goalsCompleted.length)} of ${String(summary.goalsTotal)}`}
        />
        <Stat label="Your messages" value={String(summary.learnerTurns)} />
        <Stat label="Corrections" value={String(summary.corrections.length)} />
      </View>
      <Text color="textMuted">
        {cardsAdded > 0
          ? `${String(cardsAdded)} corrected ${cardsAdded === 1 ? 'sentence was' : 'sentences were'} added to your reviews.`
          : summary.corrections.length > 0
            ? 'Your errors were noted; the tutor will watch for them next time.'
            : 'No corrections this time.'}
      </Text>
      {summary.recasts.length > 0 ? (
        <Card>
          <Text variant="heading">Corrections</Text>
          {summary.recasts.map((r, i) => (
            <View
              key={i}
              style={{ gap: spacing.xxs }}
              accessible
              accessibilityLabel={`You wrote ${r.learnerText}; better: ${r.correctedText}.`}
            >
              <DiffText diff={diffStrings(r.learnerText, r.correctedText)} />
              <Text variant="caption" color="textMuted">
                {r.errorTags.map((t) => ERROR_TAG_BY_ID.get(t)?.label ?? t).join(', ')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {summary.errorCounts.length > 0 ? (
        <Card>
          <Text variant="heading">To watch</Text>
          {summary.errorCounts.map((e) => (
            <Text key={e.tag}>
              {`${ERROR_TAG_BY_ID.get(e.tag)?.label ?? e.tag} · ${String(e.count)}`}
            </Text>
          ))}
        </Card>
      ) : null}
      {summary.newWords.length > 0 ? (
        <Card>
          <Text variant="heading">New words</Text>
          {summary.newWords.map((w) => (
            <Text key={w.lemma}>{`${w.lemma} · ${w.glossEn}`}</Text>
          ))}
        </Card>
      ) : null}
      <Button label="Done" onPress={onDone} />
    </ScrollView>
  );
}
