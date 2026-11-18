import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, EmptyState, Screen, Text, useTheme } from '@/ui';

import { ComprehensionCheck } from './components/ComprehensionCheck';
import { NewWordsPreview } from './components/NewWordsPreview';
import { PlaybackBar } from './components/PlaybackBar';
import { SentenceView } from './components/SentenceView';
import { WordSheet } from './components/WordSheet';
import { coveragePercent, FIT_LABELS } from './library';
import { estimateReadingMinutes } from './storyModel';
import { useStoryReader } from './useStoryReader';

/** Props for {@link StoryScreen}. */
export interface StoryScreenProps {
  storyId: string;
  /** Open another story (the next episode). */
  onOpenStory: (storyId: string) => void;
  /** Open a word's page. */
  onOpenWord?: (lemmaId: number) => void;
  /** Back to the library. */
  onClose: () => void;
}

/**
 * The reader and listener: the story sentence by sentence with tappable
 * words, translations, playback with the current sentence and word
 * highlighted, listening-first mode, then a comprehension check and
 * mark-as-read.
 */
export function StoryScreen({ storyId, onOpenStory, onOpenWord, onClose }: StoryScreenProps) {
  const reader = useStoryReader(storyId);
  const { colors, spacing } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef(new Map<number, number>());
  const textTop = useRef(0);
  const { data, playback, controller } = reader;

  // Keep the sentence being played in view.
  const playing = playback.status === 'playing' || playback.status === 'loading';
  useEffect(() => {
    if (!playing) return;
    const y = offsets.current.get(playback.sentenceIndex);
    if (y === undefined) return;
    scroll.current?.scrollTo({
      y: Math.max(0, textTop.current + y - spacing.xxxl),
      animated: true,
    });
  }, [playing, playback.sentenceIndex, spacing.xxxl]);

  if (!data) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState
          title="Story not found"
          message="This story is not in the current content."
          action={<Button label="Back to stories" onPress={onClose} />}
        />
      </Screen>
    );
  }
  const { story } = data;
  const sentenceText = reader.word
    ? (story.sentences[reader.word.sentenceIndex]?.it ?? null)
    : null;

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.column, { gap: spacing.md }]}>
          <Card>
            <Text variant="caption" color="textMuted">
              {`${story.series.titleIt} · Episode ${String(story.seriesIndex)} · ${story.level}`}
            </Text>
            <Text variant="title">{story.title}</Text>
            <Text color="textMuted">{story.titleEn}</Text>
            <Text
              accessibilityLabel={`You know ${coveragePercent(data.coverage)} of the words. ${FIT_LABELS[data.fit]}. About ${String(estimateReadingMinutes(story.wordCount))} minutes.`}
            >
              {`${coveragePercent(data.coverage)} known words · ${FIT_LABELS[data.fit]} · about ${String(estimateReadingMinutes(story.wordCount))} min`}
            </Text>
            <Text variant="caption" color="textMuted">
              Underlined words are ones you do not know yet. Tap a word for its meaning, or a
              sentence for its English.
            </Text>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Chip
                label="Listen first"
                accessibilityLabel="Listening first: hide the text until you tap a sentence"
                selected={reader.listenFirst}
                onPress={() => {
                  reader.setListenFirst(!reader.listenFirst);
                }}
              />
              {reader.listenFirst && !reader.allRevealed ? (
                <Button
                  variant="secondary"
                  size="compact"
                  label="Show all text"
                  onPress={() => {
                    reader.reveal('all');
                  }}
                />
              ) : null}
            </View>
          </Card>

          {reader.phase === 'reading' ? (
            <NewWordsPreview
              words={data.newWords}
              speechRate={reader.speechRate}
              onAddAll={reader.addNewWords}
            />
          ) : null}

          <View
            accessibilityLabel="Story text"
            onLayout={(e) => {
              textTop.current = e.nativeEvent.layout.y;
            }}
            style={{ gap: spacing.xs }}
          >
            {story.sentences.map((s) => (
              <View
                key={s.index}
                onLayout={(e) => {
                  offsets.current.set(s.index, e.nativeEvent.layout.y);
                }}
                style={
                  s.index > 0 && story.sentences[s.index - 1]?.paragraph !== s.paragraph
                    ? { marginTop: spacing.lg }
                    : undefined
                }
              >
                <SentenceView
                  sentence={s}
                  current={playback.sentenceIndex === s.index && playback.status !== 'idle'}
                  wordIndex={playback.sentenceIndex === s.index ? playback.wordIndex : null}
                  hidden={reader.isHidden(s.index)}
                  showTranslation={reader.translated.has(s.index)}
                  known={data.known}
                  onWordPress={reader.openWord}
                  onToggleTranslation={reader.toggleTranslation}
                  onReveal={reader.reveal}
                  onPlay={(i) => controller?.playSentence(i)}
                />
              </View>
            ))}
          </View>

          {reader.phase === 'reading' ? (
            <Card>
              <Text variant="heading">The end</Text>
              <Text color="textMuted">
                {reader.questions.length > 0
                  ? `Check your understanding with ${String(reader.questions.length)} quick questions, then the story is marked as read.`
                  : 'Mark the story as read when you have finished it.'}
              </Text>
              {reader.questions.length > 0 ? (
                <Button label="Check your understanding" onPress={reader.startCheck} />
              ) : null}
              <Button
                label="Mark as read"
                variant={reader.questions.length > 0 ? 'secondary' : 'primary'}
                onPress={() => {
                  reader.finish(null);
                }}
              />
            </Card>
          ) : null}

          {reader.phase === 'check' ? (
            <ComprehensionCheck
              questions={reader.questions}
              onDone={(correct, total) => {
                reader.finish({ correct, total });
              }}
              onSkip={() => {
                reader.finish(null);
              }}
            />
          ) : null}

          {reader.phase === 'done' ? (
            <Card accessibilityLiveRegion="polite" testID="story-done">
              <Text variant="heading">Marked as read</Text>
              {reader.result ? (
                <Text>{`You answered ${String(reader.result.correct)} of ${String(reader.result.total)} questions correctly.`}</Text>
              ) : null}
              <Text color="textMuted">
                {`${String(story.wordCount)} words read. Words you met here count towards your progress.`}
              </Text>
              {data.nextEpisodeId ? (
                <Button
                  label="Next episode"
                  onPress={() => {
                    if (data.nextEpisodeId) onOpenStory(data.nextEpisodeId);
                  }}
                />
              ) : null}
              <Button
                label="Back to stories"
                variant={data.nextEpisodeId ? 'secondary' : 'primary'}
                onPress={onClose}
              />
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {reader.phase === 'reading' ? (
        <PlaybackBar
          state={playback}
          sentenceCount={story.sentences.length}
          onToggle={() => controller?.toggle()}
          onRate={(rate) => controller?.setRate(rate)}
        />
      ) : null}

      <WordSheet
        word={reader.word?.info ?? null}
        sentence={sentenceText}
        speechRate={playback.rate}
        onAddToReviews={reader.addToReviews}
        onOpenWord={
          onOpenWord
            ? (id) => {
                reader.closeWord();
                onOpenWord(id);
              }
            : undefined
        }
        onClose={reader.closeWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
