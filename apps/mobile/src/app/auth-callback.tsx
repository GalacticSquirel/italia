import { Redirect } from 'expo-router';

/**
 * Target of sign-in email links (`italia://auth-callback?code=...`).
 * `SyncProvider` completes the sign-in from the link; this route only sends
 * the learner back to the app.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
