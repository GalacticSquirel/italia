import { createChunkedSecureStorage, type SecureStoreLike } from './secureStorage';

function memoryStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: (key) => Promise.resolve(data.get(key) ?? null),
    setItemAsync: (key, value) => {
      if (!/^[A-Za-z0-9._-]+$/.test(key)) return Promise.reject(new Error(`bad key ${key}`));
      if (value.length > 2048) return Promise.reject(new Error('value too large'));
      data.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

describe('createChunkedSecureStorage', () => {
  it('stores values larger than one SecureStore entry', async () => {
    const store = memoryStore();
    const storage = createChunkedSecureStorage(store);
    const session = JSON.stringify({ access_token: 'x'.repeat(5000), refresh_token: 'r' });
    await storage.setItem('sb-project-auth-token', session);
    expect(await storage.getItem('sb-project-auth-token')).toBe(session);
    expect(store.data.get('sb-project-auth-token.n')).toBe('3');
  });

  it('removes leftover chunks when a value shrinks, and on remove', async () => {
    const store = memoryStore();
    const storage = createChunkedSecureStorage(store, 10);
    await storage.setItem('k', 'a'.repeat(35));
    await storage.setItem('k', 'short');
    expect(await storage.getItem('k')).toBe('short');
    expect([...store.data.keys()].sort()).toEqual(['k.0', 'k.n']);
    await storage.removeItem('k');
    expect(store.data.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  it('reads a torn write as missing and sanitises keys', async () => {
    const store = memoryStore();
    const storage = createChunkedSecureStorage(store, 4);
    await storage.setItem('a key/with:odd chars', 'abcdefgh');
    expect(await storage.getItem('a key/with:odd chars')).toBe('abcdefgh');
    store.data.delete('a_key_with_odd_chars.1');
    expect(await storage.getItem('a key/with:odd chars')).toBeNull();
  });
});
