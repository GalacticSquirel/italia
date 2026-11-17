import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { createTheme, type ColorSchemeName, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(createTheme('light'));

export interface ThemeProviderProps {
  /** Force a scheme (for a user setting or tests). Defaults to the OS setting. */
  scheme?: ColorSchemeName;
  children: ReactNode;
}

/** Provides the light or dark theme, following the OS appearance by default. */
export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved: ColorSchemeName = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => createTheme(resolved), [resolved]);
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** The current theme. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
