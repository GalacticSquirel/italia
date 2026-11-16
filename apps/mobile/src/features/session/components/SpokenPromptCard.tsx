import { useMemo } from 'react';

import { DrillView } from '@/features/speak/components/DrillView';
import { MicGate } from '@/features/speak/components/MicGate';
import type { DrillItem, DrillOutcome } from '@/features/speak/drill/drillMachine';
import { useDrillRunner } from '@/features/speak/drill/useDrillRunner';
import type { SpokenPrompt } from '@/features/study/prompts';
import { Button } from '@/ui';

export interface SpokenPromptCardProps {
  cardId: string;
  prompt: SpokenPrompt;
  speechRate: number;
  /** The drill graded the answer (rating from the first attempt). */
  onAnswered: (outcome: DrillOutcome) => void;
  /** Answer by typing instead (no microphone, or the learner prefers to). */
  onTypeInstead: () => void;
}

function Drill({ cardId, prompt, speechRate, onAnswered, onTypeInstead }: SpokenPromptCardProps) {
  const items = useMemo<DrillItem[]>(
    () => [
      { cardId, cue: prompt.sentence.en, answer: prompt.sentence.it, accepted: prompt.accepted },
    ],
    [cardId, prompt],
  );
  const runner = useDrillRunner({
    items,
    rate: speechRate,
    onFinished: (outcomes) => {
      const outcome = outcomes[0];
      if (outcome) onAnswered(outcome);
      else onTypeInstead();
    },
  });
  return <DrillView runner={runner} skipLabel="Type instead" finishLabel="Continue" />;
}

/** A spoken prompt inside the study session's speaking block. */
export function SpokenPromptCard(props: SpokenPromptCardProps) {
  return (
    <MicGate
      fallback={<Button label="Type instead" variant="secondary" onPress={props.onTypeInstead} />}
    >
      <Drill {...props} />
    </MicGate>
  );
}
