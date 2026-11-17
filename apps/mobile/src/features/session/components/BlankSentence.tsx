import type { Blank } from '@/features/study/prompts';
import { Text } from '@/ui';

/** Shown in place of the missing word. */
export const BLANK = '_____';

/** An Italian sentence with one word replaced by a blank. */
export function BlankSentence({ blank }: { blank: Blank }) {
  return (
    <Text
      variant="title"
      accessibilityLabel={`Italian sentence: ${blank.before} blank ${blank.after}`}
    >
      {blank.before}
      <Text variant="title" color="primary">
        {BLANK}
      </Text>
      {blank.after}
    </Text>
  );
}
