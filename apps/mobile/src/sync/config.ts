/** Where the Supabase project lives. Only the public anon key is ever in the app. */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Raw values, normally from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. */
export interface SupabaseEnv {
  url?: string | undefined;
  anonKey?: string | undefined;
}

/**
 * Read the Supabase config from the environment, or null when it is missing
 * or malformed. Without it, accounts and sync are switched off and the app
 * works exactly as it does signed out. The URL must be https, except for a
 * local development stack on localhost or a private address.
 */
export function readSupabaseConfig(
  // Expo inlines EXPO_PUBLIC_* only for literal `process.env.NAME` reads.
  env: SupabaseEnv = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
): SupabaseConfig | null {
  const url = env.url?.trim() ?? '';
  const anonKey = env.anonKey?.trim() ?? '';
  if (url === '' || anonKey === '') return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const local = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)$/u.test(
    parsed.hostname,
  );
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) return null;
  return { url: url.replace(/\/+$/u, ''), anonKey };
}
