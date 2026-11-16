import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

/** A block of simple Markdown. */
export type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

/** An inline run of text with emphasis. */
export interface MarkdownSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Parse the small Markdown subset grammar notes use: `#` headings, `-` or
 * `*` bullets, paragraphs, `**bold**` and `*italic*`.
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (line === '') flush();
    else if (heading) {
      flush();
      blocks.push({ type: 'heading', text: heading[1] ?? '' });
    } else if (bullet) {
      flush();
      blocks.push({ type: 'bullet', text: bullet[1] ?? '' });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Split inline text into spans with `**bold**` and `*italic*` emphasis. */
export function parseInline(text: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last)
      spans.push({ text: text.slice(last, match.index), bold: false, italic: false });
    if (match[1] !== undefined) spans.push({ text: match[1], bold: true, italic: false });
    else spans.push({ text: match[2] ?? '', bold: false, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false, italic: false });
  return spans;
}

function Inline({ text }: { text: string }) {
  return parseInline(text).map((span, i) => (
    <Text
      key={i}
      style={[
        span.bold ? { fontWeight: '700' } : null,
        span.italic ? { fontStyle: 'italic' } : null,
      ]}
    >
      {span.text}
    </Text>
  ));
}

/** Renders simple Markdown (grammar notes) with the design system's text styles. */
export function Markdown({ source }: { source: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {parseMarkdown(source).map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={i} variant="heading">
                {block.text}
              </Text>
            );
          case 'bullet':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text importantForAccessibility="no" accessibilityElementsHidden>
                  •
                </Text>
                <Text style={{ flex: 1 }}>
                  <Inline text={block.text} />
                </Text>
              </View>
            );
          case 'paragraph':
            return (
              <Text key={i}>
                <Inline text={block.text} />
              </Text>
            );
        }
      })}
    </View>
  );
}
