import type { DiffSegment } from '@italia/core';

import { Text } from '@/ui';

/**
 * The learner's answer aligned against the expected one (segments from
 * core's grader): matching letters plain, wrong or extra letters struck
 * through in the error colour, missing or corrected letters in the success
 * colour, accent slips in the warning colour.
 */
export function DiffText({ diff }: { diff: readonly DiffSegment[] }) {
  return (
    <Text
      variant="heading"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {diff.map((seg, i) => {
        switch (seg.type) {
          case 'equal':
            return (
              <Text key={i} variant="heading">
                {seg.given}
              </Text>
            );
          case 'accent':
            return (
              <Text
                key={i}
                variant="heading"
                color="warning"
                style={{ textDecorationLine: 'underline' }}
              >
                {seg.expected}
              </Text>
            );
          case 'missing':
            return (
              <Text
                key={i}
                variant="heading"
                color="success"
                style={{ textDecorationLine: 'underline' }}
              >
                {seg.expected}
              </Text>
            );
          case 'extra':
            return (
              <Text
                key={i}
                variant="heading"
                color="danger"
                style={{ textDecorationLine: 'line-through' }}
              >
                {seg.given}
              </Text>
            );
          case 'substitute':
            return (
              <Text key={i} variant="heading">
                <Text
                  variant="heading"
                  color="danger"
                  style={{ textDecorationLine: 'line-through' }}
                >
                  {seg.given}
                </Text>
                <Text variant="heading" color="success" style={{ textDecorationLine: 'underline' }}>
                  {seg.expected}
                </Text>
              </Text>
            );
        }
      })}
    </Text>
  );
}
