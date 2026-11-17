import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useSync, type SyncStatus } from '@/sync';
import { Button, Card, maxFontSizeMultiplier, minTouchTarget, Text, useTheme } from '@/ui';

/** Props for {@link AccountSection}. */
export interface AccountSectionProps {
  /**
   * Returns an ID token from native Google sign-in, when the native SDK is set
   * up (docs/sync.md). Without it the Google button is not shown.
   */
  getGoogleIdToken?: () => Promise<string | null>;
  /** Clock for "last synced" text; defaults to now. */
  now?: () => Date;
}

function describeStatus(status: SyncStatus | null, now: Date): string {
  if (status === null) return 'Not synced yet.';
  if (status.state === 'syncing') return 'Syncing…';
  if (status.state === 'error') {
    return status.nextRetryAt
      ? 'Could not sync. Will try again automatically.'
      : 'Could not sync. Your progress is safe on this device.';
  }
  if (status.lastSuccessAt === null) return 'Not synced yet.';
  const minutes = Math.round((now.getTime() - status.lastSuccessAt.getTime()) / 60_000);
  const when =
    minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${String(minutes)} min ago`
        : status.lastSuccessAt.toLocaleString();
  return status.pending > 0
    ? `Last synced ${when}. ${String(status.pending)} changes waiting.`
    : `Last synced ${when}.`;
}

/**
 * Settings > Account: sign in with an emailed code (or a magic link, or
 * Google when available), see sync status, sync now, and sign out. Works
 * offline and signed out; sync is never required.
 */
export function AccountSection({ getGoogleIdToken, now = () => new Date() }: AccountSectionProps) {
  const { enabled, user, auth, status, syncNow, redirectUrl } = useSync();
  const { colors, spacing, radii, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    typography.body,
    {
      color: colors.text,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
  ];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!enabled || auth === null) {
    body = (
      <Text color="textMuted">
        Sync is not set up in this version of the app. Your progress is saved on this device.
      </Text>
    );
  } else if (user !== null) {
    body = (
      <>
        <Text>Signed in as {user.email ?? 'your account'}.</Text>
        <Text
          color={status?.state === 'error' ? 'danger' : 'textMuted'}
          accessibilityLiveRegion="polite"
        >
          {describeStatus(status, now())}
        </Text>
        <Button
          label={status?.state === 'syncing' ? 'Syncing…' : 'Sync now'}
          disabled={status?.state === 'syncing'}
          onPress={() => {
            void syncNow();
          }}
        />
        <Button
          label="Sign out"
          variant="secondary"
          disabled={busy}
          accessibilityHint="Your progress stays on this device."
          onPress={() => {
            void run(() => auth.signOut());
          }}
        />
      </>
    );
  } else {
    body = (
      <>
        <Text color="textMuted">
          Sign in to keep your progress in step across your devices. Everything still works without
          an account.
        </Text>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        />
        <Button
          label={codeSent ? 'Send a new code' : 'Email me a sign-in code'}
          variant={codeSent ? 'secondary' : 'primary'}
          disabled={busy || !email.includes('@')}
          onPress={() => {
            void run(async () => {
              await auth.sendEmailCode(email, redirectUrl ?? undefined);
              setCodeSent(true);
              setMessage('Check your email for a code, or open the link on this device.');
            });
          }}
        />
        {codeSent ? (
          <>
            <TextInput
              style={inputStyle}
              value={code}
              onChangeText={setCode}
              placeholder="Code from the email"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Code from the email"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              editable={!busy}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
            <Button
              label="Sign in"
              disabled={busy || code.trim().length < 6}
              onPress={() => {
                void run(() => auth.verifyEmailCode(email, code));
              }}
            />
          </>
        ) : null}
        {getGoogleIdToken ? (
          <Button
            label="Continue with Google"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void run(async () => {
                const token = await getGoogleIdToken();
                if (token !== null) await auth.signInWithIdToken('google', token);
              });
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Account</Text>
        {body}
        {message !== null ? (
          <Text accessibilityRole="alert" color="textMuted">
            {message}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: minTouchTarget, borderWidth: StyleSheet.hairlineWidth },
});
