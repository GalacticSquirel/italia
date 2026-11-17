import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SCENARIOS,
  summariseConversation,
  canSend,
  type NewWord,
  type TutorContext,
} from '@italia/core';

import { useRepositories } from '@/db';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { getContentIndex } from '@/features/study/content';
import { schedulerFor } from '@/features/study/planning';
import { usePracticeSession } from '@/features/study/usePracticeSession';
import { sayItalian, useSpeech } from '@/speech';
import { useTutor, type PowerAdvice } from '@/tutor';
import { Button, Chip, EmptyState, Text, TextField, useKeyboardHeight, useTheme } from '@/ui';

import { LearnerBubble, TutorBubble } from './components/ChatBubble';
import { ConversationSummaryView } from './components/ConversationSummaryView';
import { GlossPanel } from './components/GlossPanel';
import { PushToTalk } from './components/PushToTalk';
import { lookupWord } from './glossary';
import { loadLearnerProfile } from './learnerProfile';
import { recordTutorTurn } from './recordErrors';
import { useConversation } from './useConversation';

/** Props for {@link ConversationScreen}. */
export interface ConversationScreenProps {
  scenarioId: string;
  onClose: () => void;
  /** Clock (tests). */
  now?: () => Date;
}

/** Activity recorded on the study session when a conversation is ended. */
export const CONVERSATION_ACTIVITY = 'conversation';

function Chat({
  context,
  onClose,
  now,
}: {
  context: TutorContext;
  onClose: () => void;
  now: () => Date;
}) {
  const repos = useRepositories();
  const partner = useTutor();
  const speech = useSpeech();
  const rate = useSettingsStore((s) => s.settings.speechRate);
  const { colors, spacing } = useTheme();
  const keyboard = useKeyboardHeight();
  const [draft, setDraft] = useState('');
  const [voice, setVoice] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [power, setPower] = useState<PowerAdvice | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const [cardsAdded, setCardsAdded] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const voiceOn = useRef(voice);
  useEffect(() => {
    voiceOn.current = voice;
  }, [voice]);
  const [scheduler] = useState(() => schedulerFor(repos.settings.getAll()));
  const practice = usePracticeSession(CONVERSATION_ACTIVITY, now);

  const conversation = useConversation({
    partner,
    context,
    onTutorTurn: ({ output, learnerMessage }) => {
      practice.touch();
      if (learnerMessage !== null) {
        try {
          const recorded = recordTutorTurn(repos, {
            learnerMessage,
            output,
            scheduler,
            now: now(),
          });
          if (recorded.card) setCardsAdded((n) => n + 1);
        } catch {
          setNotice('A correction could not be saved.');
        }
      }
      if (voiceOn.current) void sayItalian(speech, output.reply, rate).catch(() => undefined);
      void partner.powerAdvice().then(setPower, () => undefined);
    },
    onRestoreDraft: setDraft,
  });
  const { state } = conversation;

  useEffect(() => {
    conversation.start();
    void partner.powerAdvice().then(setPower, () => undefined);
    // Start once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.phase === 'ended') practice.complete();
  }, [state.phase, practice]);

  const newWords = useMemo<NewWord[]>(
    () => state.turns.flatMap((t) => (t.role === 'tutor' ? t.output.annotations.newWords : [])),
    [state.turns],
  );
  const content = getContentIndex(repos);

  if (state.phase === 'ended') {
    return (
      <ConversationSummaryView
        summary={summariseConversation(state, context)}
        cardsAdded={cardsAdded}
        onDone={onClose}
      />
    );
  }

  const generating = state.phase === 'thinking' || state.phase === 'streaming';
  const send = (text: string) => {
    practice.touch();
    setNotice(null);
    setTapped(null);
    speech.audio.stop();
    conversation.send(text);
    setDraft('');
  };
  const goals = context.scenario.goals;

  return (
    // Pad for the keyboard to keep the message box above it (useKeyboardHeight).
    <View style={{ flex: 1, paddingBottom: keyboard }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label">{context.scenario.title}</Text>
          <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            {`${String(state.goalsCompleted.length)} of ${String(goals.length)} goals · level ${context.learner.level}`}
          </Text>
        </View>
        <Chip
          label={voice ? 'Voice on' : 'Voice off'}
          selected={voice}
          onPress={() => {
            if (voice) speech.audio.stop();
            setVoice(!voice);
          }}
          accessibilityLabel="Read replies aloud"
        />
        <Button label="End" variant="secondary" onPress={conversation.end} />
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, padding: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        testID="chat"
      >
        <Text variant="caption" color="textMuted">
          {`${context.scenario.setting} You are ${context.scenario.learnerRole}.`}
        </Text>
        <View style={{ gap: spacing.xxs }}>
          {goals.map((g) => (
            <Text
              key={g.id}
              variant="caption"
              color={state.goalsCompleted.includes(g.id) ? 'success' : 'textMuted'}
            >
              {`${state.goalsCompleted.includes(g.id) ? '✓' : '○'} ${g.description}`}
            </Text>
          ))}
        </View>
        {state.turns.map((turn, i) =>
          turn.role === 'tutor' ? (
            <TutorBubble key={i} text={turn.text} output={turn.output} onWord={setTapped} />
          ) : (
            <LearnerBubble key={i} text={turn.text} />
          ),
        )}
        {generating ? (
          state.streaming === '' ? (
            <Text color="textMuted" accessibilityLiveRegion="polite">
              The tutor is thinking…
            </Text>
          ) : (
            <TutorBubble text={state.streaming} onWord={setTapped} streaming />
          )
        ) : null}
        {state.phase === 'failed' ? (
          <View style={{ gap: spacing.sm }}>
            <Text color="danger" accessibilityRole="alert">
              {state.error ?? 'The tutor could not answer.'}
            </Text>
            <Button label="Try again" onPress={conversation.retry} />
          </View>
        ) : null}
        {state.scenarioDone ? (
          <Text color="success" accessibilityLiveRegion="polite">
            Scene complete. Keep talking, or end the conversation to see your summary.
          </Text>
        ) : null}
      </ScrollView>
      {tapped !== null ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <GlossPanel
            word={tapped}
            gloss={lookupWord(tapped, content, newWords)}
            onClose={() => {
              setTapped(null);
            }}
          />
        </View>
      ) : null}
      <View style={{ gap: spacing.sm, padding: spacing.lg }}>
        {power?.message ? (
          <Text variant="caption" color="warning" accessibilityLiveRegion="polite">
            {power.message}
          </Text>
        ) : null}
        {notice !== null ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        {!canSend(state) && state.phase === 'learner_turn' ? (
          <Text variant="caption" color="textMuted">
            That is a long conversation. End it to see your summary.
          </Text>
        ) : null}
        <TextField
          label="Your message"
          hideLabel
          placeholder="Scrivi in italiano…"
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => {
            send(draft);
          }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {generating ? (
            <Button label="Stop" variant="secondary" onPress={conversation.stop} />
          ) : (
            <Button
              label="Send"
              disabled={!canSend(state) || draft.trim() === ''}
              onPress={() => {
                send(draft);
              }}
            />
          )}
          <PushToTalk
            disabled={!canSend(state)}
            onTranscript={send}
            onError={(message) => {
              setNotice(message);
            }}
          />
        </View>
      </View>
    </View>
  );
}

/** A role-play conversation with the on-device tutor. */
export function ConversationScreen({
  scenarioId,
  onClose,
  now = () => new Date(),
}: ConversationScreenProps) {
  const repos = useRepositories();
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  const [context] = useState<TutorContext | null>(() =>
    scenario ? { learner: loadLearnerProfile(repos, now()), scenario } : null,
  );
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      {context ? (
        <Chat context={context} onClose={onClose} now={now} />
      ) : (
        <EmptyState
          title="Scenario not found"
          message="This conversation is not available."
          action={<Button label="Close" onPress={onClose} />}
        />
      )}
    </SafeAreaView>
  );
}
