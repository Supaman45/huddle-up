import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const cache = new Map<string, string>();

/** Signed URLs for the private team-media bucket, cached for the life of the app session. */
export function useSignedUrl(path: string | null | undefined, seconds = 3600) {
  // The cached value is derived, not stored: no state to set when the path changes or
  // clears, so nothing renders twice and the effect only ever runs for a real miss.
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (!path || cache.has(path)) return;
    let alive = true;
    supabase.storage
      .from('team-media')
      .createSignedUrl(path, seconds)
      .then(({ data }) => {
        if (!alive || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setFetched(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path, seconds]);
  return path ? (cache.get(path) ?? fetched) : null;
}

export function clearCrestCache(path?: string) {
  if (path) cache.delete(path);
  else cache.clear();
}

/** The team crest: the uploaded logo when there is one, the color monogram otherwise. */
export function TeamCrest({ name, color, logoPath, size = 52 }: { name: string; color: string; logoPath?: string | null; size?: number }) {
  const t = useTheme();
  const url = useSignedUrl(logoPath);
  if (!logoPath || !url) return <Avatar name={name} color={color} size={size} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        overflow: 'hidden',
        backgroundColor: t.surfaceAlt,
        borderWidth: 1,
        borderColor: color,
      }}>
      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}
