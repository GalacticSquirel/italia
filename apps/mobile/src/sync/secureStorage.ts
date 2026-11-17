/**
 * Session storage for the Supabase client, kept in the platform keystore
 * (Android Keystore, iOS Keychain) through expo-secure-store.
 *
 * SecureStore values should stay under 2048 bytes, and a Supabase session
 * (access token, refresh token, user) is often larger, so values are split
 * into chunks: `<key>.n` holds the chunk count and `<key>.0`, `<key>.1`, ...
 * the parts. Tokens never touch AsyncStorage or plain files.
 */

/** The subset of expo-secure-store this adapter uses (injectable for tests). */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** The storage interface the Supabase auth client expects. */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Characters per chunk; session JSON is ASCII, so this stays under 2048 bytes. */
export const SECURE_CHUNK_SIZE = 1800;

/** SecureStore keys may only contain letters, digits, `.`, `-` and `_`. */
const safeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/gu, '_');

/** Create a chunking {@link AuthStorage} over SecureStore. */
export function createChunkedSecureStorage(
  store: SecureStoreLike,
  chunkSize: number = SECURE_CHUNK_SIZE,
): AuthStorage {
  const countKey = (key: string) => `${safeKey(key)}.n`;
  const partKey = (key: string, i: number) => `${safeKey(key)}.${String(i)}`;

  const readCount = async (key: string): Promise<number> => {
    const raw = await store.getItemAsync(countKey(key));
    const n = raw === null ? 0 : Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  };

  const removeParts = async (key: string, from: number, to: number): Promise<void> => {
    for (let i = from; i < to; i++) await store.deleteItemAsync(partKey(key, i));
  };

  return {
    async getItem(key) {
      const n = await readCount(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await store.getItemAsync(partKey(key, i));
        if (part === null) return null; // torn write: treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      const previous = await readCount(key);
      const n = Math.max(1, Math.ceil(value.length / chunkSize));
      for (let i = 0; i < n; i++) {
        await store.setItemAsync(partKey(key, i), value.slice(i * chunkSize, (i + 1) * chunkSize));
      }
      await store.setItemAsync(countKey(key), String(n));
      await removeParts(key, n, previous);
    },
    async removeItem(key) {
      const n = await readCount(key);
      await store.deleteItemAsync(countKey(key));
      await removeParts(key, 0, n);
    },
  };
}
