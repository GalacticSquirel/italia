import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { DatabaseProvider } from '@/db';
import { SettingsHydrator } from '@/features/settings/SettingsHydrator';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { ModelsProvider } from '@/models';
import { SpeechProvider } from '@/speech';
import { SyncProvider } from '@/sync';
import { ThemeProvider, useTheme } from '@/ui';

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <DatabaseProvider>
        <SyncProvider>
          <ModelsProvider>
            <SpeechProvider>
              <SettingsHydrator />
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="models" options={{ title: 'On-device models' }} />
                <Stack.Screen name="speak/drill" options={{ title: 'Speaking drill' }} />
                <Stack.Screen name="speak/ear" options={{ title: 'Ear training' }} />
                <Stack.Screen name="speak/shadow" options={{ title: 'Shadowing' }} />
                <Stack.Screen name="speak/converse" options={{ headerShown: false }} />
                <Stack.Screen
                  name="session"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen name="word/[id]" options={{ title: 'Word' }} />
                <Stack.Screen name="grammar/index" options={{ title: 'Grammar guide' }} />
                <Stack.Screen name="grammar/[id]" options={{ title: 'Grammar' }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
              </Stack>
            </SpeechProvider>
          </ModelsProvider>
        </SyncProvider>
      </DatabaseProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const theme = useSettingsStore((s) => s.settings.theme);
  return (
    <ThemeProvider scheme={theme === 'system' ? undefined : theme}>
      <RootNavigator />
    </ThemeProvider>
  );
}
