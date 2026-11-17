import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface ScreenProps {
  /** Screen title, shown as the top heading. */
  title?: string;
  /** Safe-area edges to pad. Defaults to top, left and right (tabs own the bottom). */
  edges?: readonly Edge[];
  /** Wrap content in a ScrollView. Defaults to true. */
  scroll?: boolean;
  children?: ReactNode;
  testID?: string;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right'];

/** Page container: safe-area padding, themed background and scrolling. */
export function Screen({
  title,
  edges = DEFAULT_EDGES,
  scroll = true,
  children,
  testID,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const content = (
    <View style={[styles.content, { padding: spacing.lg, gap: spacing.lg }]}>
      {title ? <Text variant="title">{title}</Text> : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID={testID}
    >
      {scroll ? (
        // "handled": a tap on a button works while the keyboard is open,
        // instead of only dismissing the keyboard (which made "Check" and
        // "End" need two taps after typing an answer).
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
