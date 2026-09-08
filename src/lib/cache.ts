import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A tiny read-through cache for the handful of screens a parent opens standing on a field
 * with one bar of signal.
 *
 * Deliberately not a general query cache: only the data whose staleness a parent can judge
 * for themselves goes in here (the schedule, an event, who is driving), always shown with
 * the time it was captured. Anything a stale answer would make WRONG rather than merely old
 * is left out, so nobody claims a seat that filled an hour ago while offline.
 */
const PREFIX = 'hu.cache.';

export interface Cached<T> {
  value: T;
  at: number;
}

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    return typeof parsed?.at === 'number' ? parsed : null;
  } catch {
    // A corrupt or unreadable entry is the same as no entry.
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, at: Date.now() }));
  } catch {
    // Storage full or unavailable. The app works without the cache; failing here silently
    // is correct, because the live fetch already succeeded.
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // Nothing to do: the cache is best effort in both directions.
  }
}
