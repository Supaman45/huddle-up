import { format, isToday, isYesterday } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, HomeIcon, SendIcon } from '@/components/icons';
import { Avatar, BackLink, Loading, Row, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fonts, radius, space, useTheme } from '@/lib/theme';
import type { Message, Team } from '@/lib/types';
import { useSession } from '@/providers/session';

const REACTIONS = ['👍', '❤️', '😂', '🙌'];

function stamp(d: Date) {
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'EEE MMM d, h:mm a');
}

export default function TeamChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const [team, setTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    const [{ data: tm }, { data: ms }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('messages').select('*, author:profiles(*), reactions:message_reactions(emoji, profile_id)').eq('team_id', id).order('created_at', { ascending: false }).limit(200),
    ]);
    setTeam(tm as Team);
    const rows = (ms as Message[]) ?? [];
    setMessages(rows);
    const paths = rows.map((m) => m.image_path).filter((p): p is string => !!p && !urls[p]);
    if (paths.length) {
      const { data } = await supabase.storage.from('team-media').createSignedUrls(paths, 3600);
      if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string])) }));
    }
    await supabase.from('team_reads').upsert({ team_id: id, profile_id: profile!.id, last_read_at: new Date().toISOString() });
  }, [id, profile, urls]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `team_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send(imagePath?: string) {
    const body = text.trim();
    if (!body && !imagePath) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({ team_id: id, author_id: profile!.id, body: body || null, image_path: imagePath ?? null });
    setSending(false);
    if (error) return Alert.alert('Could not send', error.message);
    setText('');
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photo access is off', 'Allow photo access in Settings to share team pictures.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false, exif: false });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setSending(true);
    try {
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const blob = await (await fetch(asset.uri)).blob();
      const { error } = await supabase.storage.from('team-media').upload(path, blob, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
      if (error) throw error;
      await send(path);
    } catch (e) {
      Alert.alert('Could not upload', (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function react(m: Message, emoji: string) {
    const mine = m.reactions?.find((r) => r.profile_id === profile?.id && r.emoji === emoji);
    if (mine) await supabase.from('message_reactions').delete().eq('message_id', m.id).eq('profile_id', profile!.id).eq('emoji', emoji);
    else await supabase.from('message_reactions').insert({ message_id: m.id, profile_id: profile!.id, emoji });
  }

  function renderItem({ item: m }: { item: Message }) {
    const mine = m.author_id === profile?.id;
    const counts = (m.reactions ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }), {});
    return (
      <View style={{ paddingHorizontal: space.lg, paddingVertical: 6, flexDirection: 'row', gap: space.sm, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        {!mine ? <Avatar name={m.author?.full_name || m.author?.email || '?'} size={30} /> : null}
        <View style={{ maxWidth: '78%', gap: 4 }}>
          {!mine ? (
            <Text variant="small" color="faint" style={{ marginLeft: 4 }}>
              {m.author?.full_name?.split(' ')[0] || 'Adult'} · {stamp(new Date(m.created_at))}
            </Text>
          ) : null}
          <Pressable
            onLongPress={() =>
              Alert.alert('React', '', [...REACTIONS.map((e) => ({ text: e, onPress: () => react(m, e) })), { text: 'Cancel', style: 'cancel' as const }])
            }
            style={{
              backgroundColor: mine ? t.accent : t.surfaceAlt,
              borderRadius: radius.lg,
              borderBottomRightRadius: mine ? 6 : radius.lg,
              borderBottomLeftRadius: mine ? radius.lg : 6,
              overflow: 'hidden',
            }}>
            {m.image_path && urls[m.image_path] ? <Image source={{ uri: urls[m.image_path] }} style={{ width: 240, height: 240 }} resizeMode="cover" /> : null}
            {m.body ? (
              <Text style={{ paddingHorizontal: 14, paddingVertical: 10, color: mine ? t.accentInk : t.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 }}>{m.body}</Text>
            ) : null}
          </Pressable>
          <Row gap={4} style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
            {Object.entries(counts).map(([e, n]) => (
              <Pressable key={e} onPress={() => react(m, e)} style={{ backgroundColor: t.surface, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: t.line }}>
                <Text variant="small">
                  {e} {n > 1 ? n : ''}
                </Text>
              </Pressable>
            ))}
            {mine ? (
              <Text variant="small" color="faint">
                {stamp(new Date(m.created_at))}
              </Text>
            ) : null}
          </Row>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: space.lg, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <BackLink />
          <View style={{ alignItems: 'center' }}>
            <Text variant="h3">{team?.name ?? 'Team chat'}</Text>
            <Text variant="small" color="faint">
              Every adult on the team sees this
            </Text>
          </View>
          <Pressable onPress={() => router.replace('/(tabs)')} accessibilityLabel="Home" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <HomeIcon color={t.ink} size={20} />
          </Pressable>
        </Row>
      </View>
      {messages === null ? (
        <Loading />
      ) : (
        <FlatList
          ref={list}
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: space.md }}
          ListEmptyComponent={
            <View style={{ padding: space.xl, transform: [{ scaleY: -1 }] }}>
              <Text color="muted" style={{ textAlign: 'center' }}>
                Nothing yet. Say hi, post a field photo, or ask who is bringing the cones.
              </Text>
            </View>
          }
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, paddingBottom: insets.bottom + space.md, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
        <Pressable onPress={pickPhoto} disabled={sending} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <CameraIcon color={t.accent} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the team"
          placeholderTextColor={t.faint}
          multiline
          style={{ flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: t.line, paddingHorizontal: 16, paddingVertical: 11, color: t.ink, fontFamily: fonts.body, fontSize: 16 }}
        />
        <Pressable onPress={() => send()} disabled={sending || !text.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? t.accent : t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <SendIcon color={text.trim() ? t.accentInk : t.faint} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
