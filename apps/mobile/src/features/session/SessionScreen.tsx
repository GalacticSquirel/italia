import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useSettingsStore } from '@/features/settings/settingsStore';
import type { Prompt, TypedPrompt } from '@/features/study/prompts';
import { Button, EmptyState, ProgressBar, Screen, Text, useTheme } from '@/ui';

import { AnswerInput } from './components/AnswerInput';
import { FeedbackPanel } from './components/FeedbackPanel';
import { GrammarIntroCard } from './components/GrammarIntroCard';
import { RecognitionCard } from './components/RecognitionCard';
import { SessionSummaryView } from './components/SessionSummaryView';
import { SpokenPromptCard } from './components/SpokenPromptCard';
import { TypedPromptCard } from './components/TypedPromptCard';
import { useSession, useSessionStore } from './SessionContext';

/** Answer field label for each typed kind. */
const ANSWER_LABELS = {
  cloze_production: 'Missing word',
  grammar_cloze: 'Missing word',
  grammar_drill: 'Missing words',
  sentence_production: 'Italian sentence',
  dictation: 'What you heard',
} as const;

/** A spoken prompt answered by typing is a sentence production. */
function typedPrompt(prompt: Exclude<Prompt, { kind: 'recognition' }>): TypedPrompt {
  return prompt.kind === 'spoken_prompt'
    ? { kind: 'sentence_production', sentence: prompt.sentence, accepted: prompt.accepted }
    : prompt;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Starts the session on mount, pauses study time in the background, saves it on leave. */
function useSessionLifecycle() {
  const store = useSessionStore();
  useEffect(() => {
    const { start, pause, resume, quit } = store.getState();
    start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else pause();
    });
    return () => {
      sub.remove();
      quit();
    };
  }, [store]);
}

/** The running session: one item at a time, feedback, then the summary. */
export function SessionScreen() {
  useSessionLifecycle();
  const { spacing, colors } = useTheme();
  const phase = useSession((s) => s.phase);
  const prompt = useSession((s) => s.prompt);
  const entry = useSession((s) => s.entry);
  const feedback = useSession((s) => s.feedback);
  const grammarIntro = useSession((s) => s.grammarIntro);
  const summary = useSession((s) => s.summary);
  const error = useSession((s) => s.error);
  const queue = useSession((s) => s.queue);
  const actions = useSessionStore().getState();
  const speechRate = useSettingsStore((s) => s.settings.speechRate);
  const autoPlay = useSettingsStore((s) => s.settings.autoplayAudio);

  const done = queue?.completed.length ?? 0;
  const left = queue?.pending.length ?? 0;
  const itemKey = entry ? `${entry.item.cardId}:${String(entry.attempt)}` : 'none';
  // The learner chose to type this spoken prompt (or has no microphone).
  const [typedKey, setTypedKey] = useState<string | null>(null);

  let body;
  switch (phase) {
    case 'idle':
      body = (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Preparing your session"
        />
      );
      break;
    case 'error':
      body = (
        <EmptyState
          title="Something went wrong"
          message={error ?? 'The session could not continue. Your answers so far are saved.'}
          action={<Button label="Close" onPress={close} />}
        />
      );
      break;
    case 'empty':
      body = (
        <EmptyState
          title="Nothing to study right now"
          message="No reviews are due and today's new words are done. Come back later."
          action={<Button label="Close" onPress={close} />}
        />
      );
      break;
    case 'summary':
      body = summary ? <SessionSummaryView summary={summary} onDone={close} /> : null;
      break;
    case 'grammar_intro':
      body = grammarIntro ? (
        <GrammarIntroCard point={grammarIntro} onContinue={actions.dismissGrammarIntro} />
      ) : null;
      break;
    case 'prompt':
    case 'feedback':
      if (!prompt) break;
      if (prompt.kind === 'recognition') {
        body = (
          <RecognitionCard
            key={itemKey}
            prompt={prompt}
            speechRate={speechRate}
            autoPlay={autoPlay}
            onGotIt={actions.acknowledgeRecognition}
          />
        );
        break;
      }
      if (prompt.kind === 'spoken_prompt' && phase === 'prompt' && typedKey !== itemKey && entry) {
        body = (
          <SpokenPromptCard
            key={itemKey}
            cardId={entry.item.cardId}
            prompt={prompt}
            speechRate={speechRate}
            onAnswered={actions.answerSpoken}
            onTypeInstead={() => {
              setTypedKey(itemKey);
            }}
          />
        );
        break;
      }
      body = (
        <View key={itemKey} style={{ gap: spacing.lg }}>
          <TypedPromptCard
            prompt={typedPrompt(prompt)}
            speechRate={speechRate}
            autoPlay={autoPlay || prompt.kind === 'dictation'}
            answered={phase === 'feedback'}
          />
          {phase === 'feedback' && feedback ? (
            <FeedbackPanel
              prompt={typedPrompt(prompt)}
              feedback={feedback}
              speechRate={speechRate}
              autoPlay={autoPlay && prompt.kind !== 'dictation'}
              onContinue={actions.continue}
              onOverride={actions.overrideCorrect}
            />
          ) : (
            <AnswerInput
              label={ANSWER_LABELS[typedPrompt(prompt).kind]}
              sentence={
                prompt.kind === 'sentence_production' ||
                prompt.kind === 'dictation' ||
                prompt.kind === 'spoken_prompt'
              }
              onSubmit={actions.submitTyped}
            />
          )}
        </View>
      );
      break;
  }

  const running = phase === 'prompt' || phase === 'feedback' || phase === 'grammar_intro';
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="session-screen">
        {running ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <ProgressBar
                value={done / Math.max(1, done + left)}
                label={`Session progress: ${String(done)} answered, ${String(left)} to go`}
              />
              <Text variant="caption" color="textMuted">{`${String(left)} to go`}</Text>
            </View>
            <Button
              label="End"
              variant="secondary"
              accessibilityLabel="End session"
              accessibilityHint="Saves your progress and closes the session"
              onPress={close}
            />
          </View>
        ) : null}
        {body}
      </Screen>
    </KeyboardAvoidingView>
  );
}
