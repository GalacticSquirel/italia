import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { STATE_NAMES } from '@/features/study/format';
import { Chip, EmptyState, ListItem, Screen, Text, TextField, useTheme } from '@/ui';

import { BROWSE_FILTERS, useCardBrowser, type BrowseFilter } from './useCardBrowser';

const FILTER_NAMES: Record<BrowseFilter, string> = { ...STATE_NAMES, suspended: 'Suspended' };

function openWord(lemmaId: number) {
  router.push({ pathname: '/word/[id]', params: { id: String(lemmaId) } });
}

/** The Review tab: browse cards by state, search words, suspend cards. */
export function ReviewScreen() {
  const { spacing } = useTheme();
  const [filter, setFilter] = useState<BrowseFilter>('review');
  const [query, setQuery] = useState('');
  const { counts, cards, lemmas, setSuspended } = useCardBrowser(filter, query);
  const searching = query.trim() !== '';

  return (
    <Screen title="Review">
      <TextField
        label="Search words"
        placeholder="Search Italian or English"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {searching ? (
        <View>
          <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            {`${String(lemmas.length)} ${lemmas.length === 1 ? 'word' : 'words'} found`}
          </Text>
          {lemmas.map((l) => (
            <ListItem
              key={l.id}
              title={l.lemma}
              subtitle={l.glossEn}
              accessibilityHint="Opens the word"
              onPress={() => {
                openWord(l.id);
              }}
            />
          ))}
        </View>
      ) : (
        <>
          <View
            accessibilityRole="tablist"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
          >
            {BROWSE_FILTERS.map((f) => (
              <Chip
                key={f}
                role="tab"
                label={`${FILTER_NAMES[f]} ${String(counts[f])}`}
                accessibilityLabel={`${FILTER_NAMES[f]}, ${String(counts[f])} cards`}
                selected={f === filter}
                onPress={() => {
                  setFilter(f);
                }}
              />
            ))}
          </View>
          {cards.length === 0 ? (
            <EmptyState
              title={`No ${FILTER_NAMES[filter].toLowerCase()} cards`}
              message={
                counts.total === 0
                  ? 'Cards appear here once you start your first session on the Today tab.'
                  : 'Pick another filter, or search for a word.'
              }
            />
          ) : (
            <View>
              {cards.map((c) => (
                <ListItem
                  key={c.id}
                  title={c.title}
                  subtitle={c.subtitle}
                  detail={c.detail}
                  accessibilityHint={c.lemmaId === null ? undefined : 'Opens the word'}
                  onPress={
                    c.lemmaId === null
                      ? undefined
                      : () => {
                          openWord(c.lemmaId ?? 0);
                        }
                  }
                  trailing={
                    <Chip
                      label={c.suspended ? 'Resume' : 'Suspend'}
                      accessibilityLabel={`${c.suspended ? 'Resume' : 'Suspend'} ${c.title}`}
                      selected={false}
                      onPress={() => {
                        setSuspended(c.id, !c.suspended);
                      }}
                    />
                  }
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
