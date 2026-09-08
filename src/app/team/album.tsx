import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { CameraIcon, XIcon } from '@/components/icons';
import { Button, Card, Chip, Empty, Loading, NavBar, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
import type { Athlete, Team } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

interface MediaRow {
  id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string;
  uploaded_by: string;
  tags?: { athlete_id: string }[];
}

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { profile, athletes } = useSession();
  const toast = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [rows, setRows] = useState<MediaRow[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<MediaRow | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: tm }, { data: ta }, { data: md }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', id),
      supabase.from('media').select('*, tags:media_tags(athlete_id)').eq('team_id', id).order('taken_at', { ascending: false }).limit(200),
    ]);
    setTeam(tm as Team);
    setRoster(((ta as unknown as { athlete: Athlete }[]) ?? []).map((r) => r.athlete));
    const list = (md as MediaRow[]) ?? [];
    setRows(list);
    const paths = list.map((m) => m.storage_path);
    if (paths.length) {
      const { data } = await supabase.storage.from('team-media').createSignedUrls(paths, 3600);
      if (data) {
        setUrls(Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string])));
      }
    }
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`album-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `team_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_tags' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  // Only kids whose household allows team visibility can be tagged by other parents.
  const taggable = useMemo(
    () => roster.filter((a) => a.media_consent !== 'household' || athletes.some((mine) => mine.id === a.id)),
    [roster, athletes],
  );

  async function add() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('Allow photo access in Settings to add pictures.', { tone: 'error' });
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, allowsMultipleSelection: true, selectionLimit: 10, exif: false });
    if (res.canceled) return;
    setUploading(true);
    let ok = 0;
    for (const asset of res.assets) {
      try {
        const path = `${id}/album/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const blob = await (await fetch(asset.uri)).blob();
        const { error: upErr } = await supabase.storage.from('team-media').upload(path, blob, { contentType: asset.mimeType ?? 'image/jpeg' });
        if (upErr) throw upErr;
        const { error } = await supabase.from('media').insert({ team_id: id, storage_path: path, uploaded_by: profile!.id });
        if (error) throw error;
        ok += 1;
      } catch (e) {
        toast((e as Error).message, { tone: 'error' });
      }
    }
    setUploading(false);
    if (ok) toast(`${ok} ${ok === 1 ? 'photo' : 'photos'} added. Tap one to say who is in it.`);
    await load();
  }

  async function toggleTag(media: MediaRow, athleteId: string) {
    const has = media.tags?.some((x) => x.athlete_id === athleteId);
    if (has) {
      await supabase.from('media_tags').delete().eq('media_id', media.id).eq('athlete_id', athleteId);
    } else {
      const { error } = await supabase.from('media_tags').insert({ media_id: media.id, athlete_id: athleteId });
      if (error) return toast("That family keeps their kid's photos private.", { tone: 'signal' });
      toast(`Tagged ${roster.find((a) => a.id === athleteId)?.first_name}. It shows on their player card.`);
    }
    await load();
    const { data } = await supabase.from('media').select('*, tags:media_tags(athlete_id)').eq('id', media.id).single();
    if (data) setOpen(data as MediaRow);
  }

  async function remove(media: MediaRow) {
    await supabase.from('media').delete().eq('id', media.id);
    await supabase.storage.from('team-media').remove([media.storage_path]);
    setOpen(null);
    toast('Photo deleted', { tone: 'signal' });
    await load();
  }

  const cell = (Math.min(width, 900) - space.xl * 2 - space.sm * 2) / 3;

  return (
    <Screen glow>
      <NavBar />
      <Text variant="label" color="accent">
        {team?.name ?? 'Team'}
      </Text>
      <Text variant="display" style={{ marginTop: 4 }}>
        Season album
      </Text>
      <Text color="muted" style={{ marginTop: 6 }}>
        Photos stay with the team and with each kid's card. Nothing here is public, ever.
      </Text>

      <View style={{ marginTop: space.lg }}>
        <Button title={uploading ? 'Adding photos' : 'Add photos'} icon={<CameraIcon color={t.accentInk} size={20} />} onPress={add} loading={uploading} />
      </View>

      {rows === null ? <Loading /> : null}

      {rows?.length === 0 ? (
        <View style={{ marginTop: space.xl }}>
          <Empty title="No photos yet" body="Add the ones already on your phone from Saturday. Tag which kids are in each shot and they land on those players' cards." />
        </View>
      ) : null}

      <SectionHeader title={rows?.length ? `${rows.length} ${rows.length === 1 ? 'photo' : 'photos'}` : ' '} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(rows ?? []).map((m) => (
          <Pressable key={m.id} onPress={() => setOpen(m)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: cell, height: cell, borderRadius: radius.md, overflow: 'hidden', backgroundColor: t.surfaceAlt }}>
              {urls[m.storage_path] ? <Image source={{ uri: urls[m.storage_path] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ActivityIndicator style={{ marginTop: cell / 2 - 10 }} color={t.faint} />}
              {m.tags?.length ? (
                <View style={{ position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', gap: 3 }}>
                  {m.tags.slice(0, 4).map((tag) => (
                    <View key={tag.athlete_id} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: roster.find((a) => a.id === tag.athlete_id)?.color ?? t.accent, borderWidth: 1, borderColor: '#0F1620' }} />
                  ))}
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {/* ---------- Full view ---------- */}
      <Modal visible={!!open} animationType="fade" transparent onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,12,18,0.96)' }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 60 }}>
            <Row style={{ justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setOpen(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Close">
                <XIcon color={t.ink} />
              </Pressable>
            </Row>
            {open && urls[open.storage_path] ? (
              <Image source={{ uri: urls[open.storage_path] }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg }} resizeMode="contain" />
            ) : null}
            {open ? (
              <Card style={{ marginTop: space.lg }}>
                <Text variant="label" color="faint">
                  {format(new Date(open.taken_at), 'EEEE, MMM d')}
                </Text>
                <Text variant="h3" style={{ marginTop: 6 }}>
                  Who's in this one?
                </Text>
                <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                  {taggable.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.first_name}
                      dot={a.color}
                      selected={open.tags?.some((x) => x.athlete_id === a.id)}
                      onPress={() => toggleTag(open, a.id)}
                    />
                  ))}
                </Row>
                {taggable.length < roster.length ? (
                  <Text variant="small" color="faint" style={{ marginTop: space.md }}>
                    Some families keep their kid's photos private to their household, so those players cannot be tagged.
                  </Text>
                ) : null}
                {open.uploaded_by === profile?.id ? (
                  <View style={{ marginTop: space.lg }}>
                    <Button title="Delete photo" kind="ghost" onPress={() => remove(open)} />
                  </View>
                ) : null}
              </Card>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Stack style={{ marginTop: space.xxl }}>
        <Text variant="small" color="faint">
          A parent can untag their own kid at any time from this screen or the player card.
        </Text>
      </Stack>
      <View style={{ height: 40 }} />
      <Button title="Back to team" kind="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
