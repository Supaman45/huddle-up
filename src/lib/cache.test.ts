import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    getAllKeys: async () => [...store.keys()],
    multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
  },
}));

const { clearCache, readCache, writeCache } = await import('@/lib/cache');

describe('cache', () => {
  beforeEach(() => store.clear());

  it('round-trips a value with the time it was captured', async () => {
    const before = Date.now();
    await writeCache('events', [{ id: 'e1' }]);
    const got = await readCache<{ id: string }[]>('events');
    expect(got?.value).toEqual([{ id: 'e1' }]);
    expect(got?.at).toBeGreaterThanOrEqual(before);
  });

  it('returns nothing for a key that was never written', async () => {
    expect(await readCache('nope')).toBeNull();
  });

  it('treats a corrupt entry as a miss rather than throwing at a parent', async () => {
    store.set('hu.cache.events', '{ not json');
    expect(await readCache('events')).toBeNull();
  });

  it('rejects an entry with no capture time, since the banner would lie about age', async () => {
    store.set('hu.cache.events', JSON.stringify({ value: [1, 2] }));
    expect(await readCache('events')).toBeNull();
  });

  it('clears only its own keys, leaving the auth session alone', async () => {
    await writeCache('events', [1]);
    store.set('supabase.auth.token', 'keep-me');
    await clearCache();
    expect(await readCache('events')).toBeNull();
    expect(store.get('supabase.auth.token')).toBe('keep-me');
  });
});
