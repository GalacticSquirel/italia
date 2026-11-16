import { readSupabaseConfig } from './config';

describe('readSupabaseConfig', () => {
  it('is null when either value is missing, so sync stays off', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ url: 'https://x.supabase.co', anonKey: ' ' })).toBeNull();
    expect(readSupabaseConfig({ url: '', anonKey: 'key' })).toBeNull();
  });

  it('accepts https, and http only for a local stack', () => {
    expect(readSupabaseConfig({ url: 'https://abc.supabase.co/', anonKey: 'key' })).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'key',
    });
    expect(readSupabaseConfig({ url: 'http://192.168.1.20:54321', anonKey: 'k' })?.url).toBe(
      'http://192.168.1.20:54321',
    );
    expect(readSupabaseConfig({ url: 'http://example.com', anonKey: 'k' })).toBeNull();
    expect(readSupabaseConfig({ url: 'not a url', anonKey: 'k' })).toBeNull();
  });
});
