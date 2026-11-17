import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { useDatabase, useRepositories } from '@/db';
import { AccountSection } from '@/features/account/AccountSection';
import { Button, Card, ListItem, Screen, SegmentedControl, Stepper, Text, useTheme } from '@/ui';

import { pickAndImportBackup, shareBackup } from './backupFiles';
import { useSettingsStore } from './settingsStore';
import { useSettings } from './useSettings';

/** Range of desired retention offered in the app. */
export const RETENTION_RANGE = { min: 0.8, max: 0.95, step: 0.01 } as const;

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

type BackupStatus =
  { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' | 'error'; message: string };

/** Settings: daily limits, memory target, voice, appearance and backup. */
export function SettingsScreen() {
  const { settings, setSetting } = useSettings();
  const db = useDatabase();
  const repos = useRepositories();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const { colors, spacing } = useTheme();
  const [backup, setBackup] = useState<BackupStatus>({ kind: 'idle' });
  const busy = backup.kind === 'busy';

  const runBackup = async (task: () => Promise<string | null>) => {
    setBackup({ kind: 'busy' });
    try {
      const message = await task();
      setBackup(message === null ? { kind: 'idle' } : { kind: 'done', message });
    } catch (e) {
      setBackup({
        kind: 'error',
        message: `That did not work: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card>
        <Text variant="heading">Daily study</Text>
        <Stepper
          label="New words per day"
          hint="Each new word is shown, then practised in a sentence."
          value={settings.dailyNewLimit}
          min={0}
          max={100}
          step={5}
          onChange={(v) => {
            setSetting('dailyNewLimit', v);
          }}
        />
        <Stepper
          label="Daily time budget"
          hint="New words slow down when reviews would not fit."
          value={settings.minutesBudget}
          min={5}
          max={240}
          step={5}
          format={(v) => `${String(v)} min`}
          onChange={(v) => {
            setSetting('minutesBudget', v);
          }}
        />
        <Stepper
          label="Target recall"
          hint="Higher means more frequent reviews."
          value={Math.min(
            RETENTION_RANGE.max,
            Math.max(RETENTION_RANGE.min, settings.desiredRetention),
          )}
          min={RETENTION_RANGE.min}
          max={RETENTION_RANGE.max}
          step={RETENTION_RANGE.step}
          format={(v) => `${String(Math.round(v * 100))}%`}
          onChange={(v) => {
            setSetting('desiredRetention', v);
          }}
        />
      </Card>

      <Card>
        <Text variant="heading">Audio</Text>
        <Stepper
          label="Speech speed"
          value={settings.speechRate}
          min={0.5}
          max={1.5}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(v) => {
            setSetting('speechRate', v);
          }}
        />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
        >
          <Text style={{ flex: 1 }} importantForAccessibility="no">
            Play audio automatically
          </Text>
          <Switch
            accessibilityLabel="Play audio automatically"
            value={settings.autoplayAudio}
            onValueChange={(v) => {
              setSetting('autoplayAudio', v);
            }}
            trackColor={{ true: colors.primary, false: colors.track }}
          />
        </View>
      </Card>

      <Card>
        <Text variant="heading">Speech</Text>
        <ListItem
          title="On-device models"
          subtitle="Speech recognition, pronunciation scoring and voices"
          accessibilityHint="Opens downloads and storage for on-device models"
          onPress={() => {
            router.push('/models');
          }}
        />
      </Card>

      <Card>
        <Text variant="heading">Appearance</Text>
        <SegmentedControl
          label="Theme"
          options={THEMES}
          value={settings.theme}
          onChange={(v) => {
            setSetting('theme', v);
          }}
        />
      </Card>

      <Card>
        <Text variant="heading">Backup</Text>
        <Text color="textMuted">
          Save all your progress to a file, or restore from one. Restoring merges with what is on
          this phone; nothing is deleted.
        </Text>
        <Button
          label="Export backup"
          disabled={busy}
          onPress={() => {
            void runBackup(async () =>
              (await shareBackup(db)) ? null : 'Sharing is not available on this device.',
            );
          }}
        />
        <Button
          label="Import backup"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void runBackup(async () => {
              const result = await pickAndImportBackup(db);
              if (!result) return null;
              hydrate(repos);
              return `Restored ${String(result.reviewLogs.inserted)} reviews and ${String(
                result.cards.inserted + result.cards.updated,
              )} cards.`;
            });
          }}
        />
        {backup.kind === 'done' || backup.kind === 'error' ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            color={backup.kind === 'error' ? 'danger' : 'success'}
          >
            {backup.message}
          </Text>
        ) : null}
      </Card>

      <AccountSection />
    </Screen>
  );
}
