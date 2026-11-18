import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';

/** The signed-in account, as the UI needs it. */
export interface AccountUser {
  id: string;
  email: string | null;
}

/** Account sign-in and sign-out. Every method works on top of the local-first app: none is required. */
export interface AuthService {
  /** The stored account, or null when signed out. */
  getUser: () => Promise<AccountUser | null>;
  /** Call `listener` when the account changes. Returns an unsubscribe function. */
  onChange: (listener: (user: AccountUser | null, event: AuthChangeEvent) => void) => () => void;
  /**
   * Email a one-time code (and a magic link to `redirectTo`) to `email`.
   * Creates the account on first use.
   */
  sendEmailCode: (email: string, redirectTo?: string) => Promise<void>;
  /** Sign in with the code from the email. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /**
   * Finish a magic-link sign-in from the deep link the app was opened with
   * (`italia://auth-callback?code=...`). Returns false when `url` is not one.
   */
  completeFromUrl: (url: string) => Promise<boolean>;
  /**
   * Sign in with an ID token from native Google (or Apple) sign-in. The
   * native SDK that produces the token is set up separately (docs/sync.md).
   */
  signInWithIdToken: (
    provider: 'google' | 'apple',
    idToken: string,
    nonce?: string,
  ) => Promise<void>;
  /** Sign out on this device only (works offline; local data is kept). */
  signOut: () => Promise<void>;
}

const toUser = (session: Session | null): AccountUser | null =>
  session === null ? null : { id: session.user.id, email: session.user.email ?? null };

/** Thrown when an auth call fails; `message` is safe to show. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** What Supabase reports about a failed auth call. */
export interface AuthFailure {
  message: string;
  code?: string;
  status?: number;
  name?: string;
}

/**
 * The learner-facing text for a failed auth call. Supabase's own messages are
 * written for developers ("Token has expired or is invalid"), so the common
 * cases get plain wording; anything else keeps the server's message.
 */
export function authErrorMessage(error: AuthFailure): string {
  const code = error.code ?? '';
  if (code === 'otp_expired' || /token has expired or is invalid/i.test(error.message)) {
    return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  }
  if (code.startsWith('over_') || error.status === 429) {
    return 'Too many tries. Wait a minute, then try again.';
  }
  if (code === 'email_address_invalid' || /email address .* invalid/i.test(error.message)) {
    return 'That email address does not look right.';
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Could not reach the sync server. Check your connection and try again.';
  }
  return error.message;
}

function check(result: { error: AuthFailure | null }): void {
  if (result.error) throw new AuthError(authErrorMessage(result.error));
}

/** {@link AuthService} over a Supabase client. */
export function createAuthService(client: Pick<SupabaseClient, 'auth'>): AuthService {
  return {
    async getUser() {
      const { data } = await client.auth.getSession();
      return toUser(data.session);
    },
    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener(toUser(session), event);
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },
    async sendEmailCode(email, redirectTo) {
      check(
        await client.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
        }),
      );
    },
    async verifyEmailCode(email, code) {
      check(
        await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }),
      );
    },
    async completeFromUrl(url) {
      const code = authCodeFromUrl(url);
      if (code === null) return false;
      check(await client.auth.exchangeCodeForSession(code));
      return true;
    },
    async signInWithIdToken(provider, idToken, nonce) {
      check(await client.auth.signInWithIdToken({ provider, token: idToken, nonce }));
    },
    async signOut() {
      check(await client.auth.signOut({ scope: 'local' }));
    },
  };
}

/** The PKCE `code` of a sign-in deep link (`.../auth-callback?code=...`), or null. */
export function authCodeFromUrl(url: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/\/?auth-callback\/?\?(.*)$/iu.exec(url);
  if (match === null) return null;
  const params = new URLSearchParams(match[1]?.split('#')[0] ?? '');
  const code = params.get('code');
  return code === null || code === '' ? null : code;
}
