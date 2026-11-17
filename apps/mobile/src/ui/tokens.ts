/**
 * Design tokens. Components read these through `useTheme()` so light and dark
 * mode stay in sync; never hard-code colours or sizes in screens.
 */

export type ColorSchemeName = 'light' | 'dark';

export interface ColorTokens {
  /** Screen background. */
  background: string;
  /** Raised surfaces such as cards. */
  surface: string;
  /** Hairlines and card borders. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary text: captions, hints. */
  textMuted: string;
  /** Brand colour for primary actions and progress. */
  primary: string;
  /** Text and icons drawn on `primary`. */
  onPrimary: string;
  /** Pressed state of `primary`. */
  primaryPressed: string;
  /** Track behind progress bars, disabled fills. */
  track: string;
  /** Correct answers, positive states. */
  success: string;
  /** Errors and wrong answers. */
  danger: string;
  /** Near misses: accent-only or typo answers. */
  warning: string;
  /** Background behind correct-answer feedback. */
  successSurface: string;
  /** Background behind wrong-answer feedback. */
  dangerSurface: string;
  /** Focus outline. */
  focus: string;
}

/**
 * Colour palettes. Text colours meet WCAG AA (4.5:1) against `background` and
 * `surface`; `onPrimary` meets AA against `primary`.
 */
export const palettes: Record<ColorSchemeName, ColorTokens> = {
  light: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    border: '#E4DFD8',
    text: '#1C1B19',
    textMuted: '#5E5A54',
    primary: '#0B6B4F',
    onPrimary: '#FFFFFF',
    primaryPressed: '#08553F',
    track: '#E4DFD8',
    success: '#1E7A3C',
    danger: '#B3261E',
    warning: '#8A5300',
    successSurface: '#E4F2E8',
    dangerSurface: '#FBE6E4',
    focus: '#1F5FBF',
  },
  dark: {
    background: '#121211',
    surface: '#1E1D1B',
    border: '#3A3834',
    text: '#F3F1EE',
    textMuted: '#B4AFA7',
    primary: '#5CC39A',
    onPrimary: '#0B1F17',
    primaryPressed: '#7FD3B0',
    track: '#3A3834',
    success: '#6FCF8E',
    danger: '#F2B8B5',
    warning: '#F2C46D',
    successSurface: '#17301F',
    dangerSurface: '#3A1E1C',
    focus: '#8AB4F8',
  },
};

/** Spacing scale in points. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii in points. */
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target size (Apple HIG 44pt; Android asks for 48dp). */
export const minTouchTarget = 48;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
}

/**
 * Type scale. Sizes are base sizes: the OS text-size setting scales them
 * (dynamic type), so layouts must not assume fixed text heights.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
} as const satisfies Record<string, TypeStyle>;

export type TypographyVariant = keyof typeof typography;

/** Largest font scale we let text grow to before it stops scaling. */
export const maxFontSizeMultiplier = 2;

export interface Theme {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

/** Build the theme for a colour scheme. */
export function createTheme(scheme: ColorSchemeName): Theme {
  return { scheme, colors: palettes[scheme], spacing, radii, typography };
}
