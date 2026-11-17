import { View } from 'react-native';

import type { TypedPrompt } from '@/features/study/prompts';
import { Card, Text, useTheme } from '@/ui';

import { BlankSentence } from './BlankSentence';
import { ListenButton } from './ListenButton';

export interface TypedPromptCardProps {
  prompt: TypedPrompt;
  speechRate: number;
  /** Play dictation audio when shown. */
  autoPlay: boolean;
  /** The answer has been checked: hide anything that would give it away twice. */
  answered: boolean;
}

/** Instruction shown above each kind of typed prompt. */
export const INSTRUCTIONS: Record<TypedPrompt['kind'], string> = {
  cloze_production: 'Fill in the missing word',
  grammar_cloze: 'Fill in the right form',
  grammar_drill: 'Fill in the gap',
  sentence_production: 'Say it in Italian',
  dictation: 'Type what you hear',
};

/** Instruction for a sentence corrected in conversation. */
export const CORRECTION_INSTRUCTION = 'Write this sentence correctly';

/** The question part of a typed card (the answer field is separate). */
export function TypedPromptCard({ prompt, speechRate, autoPlay, answered }: TypedPromptCardProps) {
  const { spacing } = useTheme();
  return (
    <Card>
      <Text variant="caption" color="textMuted">
        {prompt.kind === 'sentence_production' && prompt.correction
          ? CORRECTION_INSTRUCTION
          : INSTRUCTIONS[prompt.kind]}
      </Text>
      {prompt.kind === 'cloze_production' ? (
        <>
          <BlankSentence blank={prompt.blank} />
          <Text color="textMuted">{prompt.sentence.en}</Text>
          <Text variant="caption" color="textMuted">
            {`Hint: ${prompt.lemma.glossEn}`}
          </Text>
        </>
      ) : null}
      {prompt.kind === 'grammar_cloze' ? (
        <>
          {prompt.grammarPoint ? (
            <Text variant="label" color="primary">
              {prompt.grammarPoint.title}
            </Text>
          ) : null}
          <BlankSentence blank={prompt.blank} />
          <Text color="textMuted">{prompt.sentence.en}</Text>
          <Text variant="bodyStrong" accessibilityLabel={`Use a form of ${prompt.baseForm}`}>
            {`Use: ${prompt.baseForm}`}
          </Text>
        </>
      ) : null}
      {prompt.kind === 'grammar_drill' ? (
        <>
          {prompt.grammarPoint ? (
            <Text variant="label" color="primary">
              {prompt.grammarPoint.title}
            </Text>
          ) : null}
          <BlankSentence blank={prompt.blank} />
          <Text color="textMuted">{prompt.drill.en}</Text>
          <Text variant="bodyStrong" accessibilityLabel={`Hint: ${prompt.drill.hint}`}>
            {`Use: ${prompt.drill.hint}`}
          </Text>
        </>
      ) : null}
      {prompt.kind === 'sentence_production' && prompt.correction ? (
        <>
          <Text variant="title" accessibilityLabel={`You wrote: ${prompt.correction.original}`}>
            {prompt.correction.original}
          </Text>
          <Text variant="caption" color="textMuted">
            From a conversation
          </Text>
        </>
      ) : null}
      {prompt.kind === 'sentence_production' && !prompt.correction ? (
        <Text variant="title" accessibilityLabel={`English sentence: ${prompt.sentence.en}`}>
          {prompt.sentence.en}
        </Text>
      ) : null}
      {prompt.kind === 'dictation' ? (
        <View style={{ gap: spacing.sm }}>
          <ListenButton
            text={prompt.sentence.it}
            rate={speechRate}
            autoPlay={autoPlay && !answered}
            label="Play sentence"
            variant="primary"
          />
          <ListenButton text={prompt.sentence.it} rate={speechRate * 0.7} label="Play slowly" />
        </View>
      ) : null}
    </Card>
  );
}
