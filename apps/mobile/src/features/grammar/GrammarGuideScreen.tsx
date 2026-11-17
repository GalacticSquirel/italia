import { router } from 'expo-router';

import { Card, List, ListItem, Screen, Text } from '@/ui';

import { STATUS_TEXT } from './grammarGuide';
import { useGrammarGuide } from './useGrammarGuide';

/** Every grammar point by level, to re-read an explanation at any time. */
export function GrammarGuideScreen() {
  const levels = useGrammarGuide();
  const learnt = levels.flatMap((l) => l.points).filter((p) => p.status === 'learnt').length;
  const total = levels.reduce((n, l) => n + l.points.length, 0);
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Text color="textMuted">
        {`You have learnt ${String(learnt)} of ${String(total)} grammar points. New points come in your daily sessions; tap any point to read its explanation.`}
      </Text>
      {levels.map((level) => (
        <Card key={level.cefr ?? 'other'}>
          <Text variant="heading" accessibilityRole="header">
            {level.cefr ?? 'Other'}
          </Text>
          {level.wordsNeeded > 0 ? (
            <Text variant="caption" color="textMuted">
              {`Opens once you have met ${String(level.wordsNeeded)} words.`}
            </Text>
          ) : null}
          <List>
            {level.points.map((p) => (
              <ListItem
                key={p.point.id}
                title={p.point.title}
                subtitle={
                  p.drillsTotal > 0
                    ? `${String(p.drillsDone)} of ${String(p.drillsTotal)} exercises done`
                    : undefined
                }
                detail={STATUS_TEXT[p.status]}
                accessibilityHint="Opens the explanation"
                onPress={() => {
                  router.push(`/grammar/${String(p.point.id)}`);
                }}
              />
            ))}
          </List>
        </Card>
      ))}
    </Screen>
  );
}
