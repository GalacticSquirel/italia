import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import { maxFontSizeMultiplier, type ColorTokens, type TypographyVariant } from './tokens';

export interface TextProps extends RNTextProps {
  /** Type scale entry. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Colour token. Defaults to `text`. */
  color?: keyof ColorTokens;
}

const HEADER_VARIANTS = new Set<TypographyVariant>(['display', 'title', 'heading']);

/**
 * Themed text. Scales with the OS text size (up to {@link maxFontSizeMultiplier}),
 * and titles are exposed to screen readers as headers.
 */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      accessibilityRole={HEADER_VARIANTS.has(variant) ? 'header' : undefined}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[theme.typography[variant], { color: theme.colors[color] }, style]}
    />
  );
}
