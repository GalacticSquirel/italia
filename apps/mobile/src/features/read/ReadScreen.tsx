import { View } from 'react-native';

import { Button, Card, EmptyState, ListItem, Screen, Text, useTheme } from '@/ui';

import { coveragePercent, FIT_LABELS, type LibraryEpisode, type LibrarySeries } from './library';
import { estimateReadingMinutes } from './storyModel';
import { useLibrary } from './useLibrary';

/** Props for {@link ReadScreen}. */
export interface ReadScreenProps {
  onOpenStory: (storyId: string) => void;
}

const FIT_NOTES = {
  ideal: 'You know enough of its words to read for meaning and pick up the new ones.',
  easy: 'Comfortable reading with few new words: good for fluency.',
  stretch: 'Below the ideal 95% of known words: expect to tap more words.',
  hard: 'Too many unknown words to read comfortably yet.',
} as const;

function episodeSubtitle(e: LibraryEpisode): string {
  if (e.locked) return `Locked: read episode ${String(e.seriesIndex - 1)} first`;
  const known = `${coveragePercent(e.coverage.ratio)} known · ${FIT_LABELS[e.fit]}`;
  return e.read ? `Read · ${known}` : known;
}

function UpNext({ episode, onOpen }: { episode: LibraryEpisode; onOpen: () => void }) {
  const { story } = episode;
  const newWords = episode.unmetTargetLemmaIds.length;
  return (
    <Card testID="up-next">
      <Text variant="caption" color="textMuted">
        Up next
      </Text>
      <Text variant="heading">{story.title}</Text>
      <Text color="textMuted">{story.titleEn}</Text>
      <Text variant="caption" color="textMuted">
        {`${story.series.titleIt} · Episode ${String(story.seriesIndex)} · ${story.level} · about ${String(estimateReadingMinutes(story.wordCount))} min`}
      </Text>
      <Text variant="bodyStrong">
        {`${coveragePercent(episode.coverage.ratio)} of its words known · ${FIT_LABELS[episode.fit]}`}
      </Text>
      <Text color="textMuted">{FIT_NOTES[episode.fit]}</Text>
      {newWords > 0 ? (
        <Text color="textMuted">{`Introduces ${String(newWords)} new ${newWords === 1 ? 'word' : 'words'}.`}</Text>
      ) : null}
      <Button
        label="Read"
        accessibilityLabel={`Read ${story.title}`}
        accessibilityHint="Opens the story"
        onPress={onOpen}
      />
    </Card>
  );
}

function SeriesCard({
  series,
  onOpen,
}: {
  series: LibrarySeries;
  onOpen: (storyId: string) => void;
}) {
  return (
    <Card>
      <Text variant="heading">{series.series.titleIt}</Text>
      <Text variant="caption" color="textMuted">
        {`${series.series.titleEn} · ${series.level} · ${String(series.readCount)} of ${String(series.episodes.length)} read`}
      </Text>
      <Text color="textMuted">{series.series.blurb}</Text>
      <View>
        {series.episodes.map((e) => (
          <ListItem
            key={e.id}
            title={`${String(e.seriesIndex)}. ${e.story.title}`}
            subtitle={episodeSubtitle(e)}
            onPress={
              e.locked
                ? undefined
                : () => {
                    onOpen(e.id);
                  }
            }
            accessibilityHint={e.locked ? undefined : 'Opens the story'}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * The Read tab: what to read next (chosen by known-word coverage) and the
 * library of graded series, with episodes unlocking in order.
 */
export function ReadScreen({ onOpenStory }: ReadScreenProps) {
  const library = useLibrary();
  const { spacing } = useTheme();

  if (library.series.length === 0) {
    return (
      <Screen title="Read">
        <EmptyState
          title="No stories yet"
          message="The graded stories have not been installed on this device."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Read">
      {library.upNext ? (
        <UpNext
          episode={library.upNext}
          onOpen={() => {
            if (library.upNext) onOpenStory(library.upNext.id);
          }}
        />
      ) : (
        <Card testID="up-next">
          <Text variant="heading">No story fits you yet</Text>
          <Text color="textMuted">
            Stories work best when you know 95 to 98% of their words, and at least 90%. Keep
            learning words in your daily session and stories will open up.
          </Text>
          {library.closest ? (
            <>
              <Text>
                {`Closest: ${library.closest.story.title}, with ${coveragePercent(library.closest.coverage.ratio)} of its words known.`}
              </Text>
              <Button
                label="Try it anyway"
                variant="secondary"
                accessibilityHint="Opens the closest story; expect many new words"
                onPress={() => {
                  if (library.closest) onOpenStory(library.closest.id);
                }}
              />
            </>
          ) : null}
        </Card>
      )}
      <Text variant="caption" color="textMuted">
        {`Coverage counts the ${String(library.knownWords)} ${library.knownWords === 1 ? 'word' : 'words'} you know well (names are not counted).`}
      </Text>
      <View style={{ gap: spacing.lg }}>
        <Text variant="heading">Library</Text>
        {library.series.map((s) => (
          <SeriesCard key={s.seriesId} series={s} onOpen={onOpenStory} />
        ))}
      </View>
    </Screen>
  );
}
