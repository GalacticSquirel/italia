import { Card, EmptyState, Markdown, Screen, Text } from '@/ui';

import { STATUS_TEXT } from './grammarGuide';
import { useGrammarPoint } from './useGrammarGuide';

/** Exercises shown as worked examples under an explanation. */
const WORKED_EXAMPLES = 3;

/** One grammar point: its explanation, worked examples and progress. */
export function GrammarPointScreen({ pointId }: { pointId: number }) {
  const entry = useGrammarPoint(pointId);
  if (!entry) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState title="Point not found" message="This grammar point is not in the content." />
      </Screen>
    );
  }
  const { point, cefr, status, drills, drillsDone, drillsTotal } = entry;
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card>
        <Text variant="caption" color="textMuted">
          {[cefr, STATUS_TEXT[status]].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {point.title}
        </Text>
        <Markdown source={point.noteMd} />
      </Card>
      {drills.length > 0 ? (
        <Card>
          <Text variant="heading" accessibilityRole="header">
            Worked examples
          </Text>
          {drills.slice(0, WORKED_EXAMPLES).map((d) => (
            <Text key={d.id} accessibilityLabel={`${d.it} ${d.en}`}>
              {d.before}
              <Text variant="bodyStrong" color="primary">
                {d.answer}
              </Text>
              {d.after}
              <Text color="textMuted">{` (${d.en})`}</Text>
            </Text>
          ))}
          <Text variant="caption" color="textMuted">
            {`${String(drillsDone)} of ${String(drillsTotal)} exercises done. The rest come in your sessions and reviews.`}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
