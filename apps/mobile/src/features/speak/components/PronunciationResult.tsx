import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { PronunciationAnalysis } from '@/speech';
import { Card, Text, type ColorTokens } from '@/ui';

/** Word score bands: clear, nearly, needs work. */
export function bandOf(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 0.8) return 'good';
  if (score >= 0.6) return 'fair';
  return 'poor';
}

const BAND_COLOR: Record<ReturnType<typeof bandOf>, keyof ColorTokens> = {
  good: 'success',
  fair: 'warning',
  poor: 'danger',
};

const BAND_WORD: Record<ReturnType<typeof bandOf>, string> = {
  good: 'clear',
  fair: 'nearly',
  poor: 'needs work',
};

export interface PronunciationResultProps {
  analysis: PronunciationAnalysis | null;
  /** Whether pronunciation scoring is installed. */
  scorerReady: boolean;
}

/**
 * The separate pronunciation score: the model sentence with each word
 * coloured by its score (spans from the G2P result) and at most two tips.
 * Guidance only; it never changes the rating.
 */
export function PronunciationResult({ analysis, scorerReady }: PronunciationResultProps) {
  if (!scorerReady) {
    return (
      <Text variant="caption" color="textMuted">
        Download pronunciation scoring in Settings, On-device models, to get feedback on your
        pronunciation.
      </Text>
    );
  }
  if (!analysis) {
    return (
      <Text variant="caption" color="textMuted">
        Scoring your pronunciation…
      </Text>
    );
  }
  const { g2p, score } = analysis;
  const parts: ReactNode[] = [];
  let cursor = 0;
  g2p.words.forEach((word, i) => {
    if (word.span.start > cursor) parts.push(g2p.text.slice(cursor, word.span.start));
    const band = bandOf(score.words[i]?.score ?? 0);
    parts.push(
      <Text
        key={i}
        variant="heading"
        color={BAND_COLOR[band]}
        style={band === 'good' ? undefined : { textDecorationLine: 'underline' }}
      >
        {g2p.text.slice(word.span.start, word.span.end)}
      </Text>,
    );
    cursor = word.span.end;
  });
  if (cursor < g2p.text.length) parts.push(g2p.text.slice(cursor));
  const summary = g2p.words
    .map((w, i) => `${w.text} ${BAND_WORD[bandOf(score.words[i]?.score ?? 0)]}`)
    .join(', ');
  return (
    <Card testID="pronunciation-result">
      <Text variant="caption" color="textMuted">
        {`Pronunciation ${String(Math.round(score.overall * 100))}%`}
      </Text>
      <Text variant="heading" accessibilityLabel={`Pronunciation by word: ${summary}`}>
        {parts}
      </Text>
      <View accessibilityRole="list">
        {score.issues.map((issue, i) => (
          <Text key={i}>{`• ${issue.message}`}</Text>
        ))}
      </View>
      {score.issues.length === 0 ? <Text color="success">Nicely said.</Text> : null}
    </Card>
  );
}
