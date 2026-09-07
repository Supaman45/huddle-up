import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { Avatar, Button, Card, Chip, Empty, Input, ListRow, Loading, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, sportLabel, useTheme } from '@/lib/theme';
import type { Athlete, MyEvent, Team, TeamMember } from '@/lib/types';
import { useSession } from '@/providers/session';

export default function TeamSpace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { profile, athletes } = useSession();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [tab, setTab] = useState<'schedule' | 'people' | 'settings'>('schedule');
  const [syncing, setSyncing] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', when: '', location: '' });

  const myRole = members.find((m) => m.profile_id === profile?.id)?.role;
  const isStaff = myRole === 'manager' || myRole === 'coach';

  const load = useCallback(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 90);
    const [{ data: tm }, { data: mem }, { data: ta }, { data: ev }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('team_members').select('*, profile:profiles(*)').eq('team_id', id),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', id),
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
    ]);
    setTeam(tm as Team);
    setMembers((mem as TeamMember[]) ?? []);
    setRoster(((ta as unknown as { athlete: Athlete }[]) ?? []).map((r) => r.athlete));
    setEvents(((ev as MyEvent[]) ?? []).filter((e) => e.team_id === id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function share() {
    if (!team) return;
    const msg = `Join ${team.name} on Huddle Up for the schedule, carpools and snack signups. Free, no ads. Enter code ${team.join_code} or open https://huddleup.app/join/${team.join_code}`;
    try {
      await Share.share({ message: msg });
    } catch {
      await Clipboard.setStringAsync(msg);
      Alert.alert('Copied', 'Invite text copied.');
    }
  }

  async function syncNow() {
    setSyncing(true);
    const { error } = await supabase.functions.invoke('ics-sync', { body: { team_id: id } });
    setSyncing(false);
    if (error) Alert.alert('Sync failed', error.message);
    await load();
  }

  async function addEvent() {
    if (!newEvent.title.trim() || !newEvent.when.trim()) return Alert.alert('Add a title and a start time.');
    const when = new Date(newEvent.when);
    if (Number.isNaN(when.getTime())) return Alert.alert('Use a date like 2026-09-14 09:30');
    const isGame = /game|match|vs\.?|@/i.test(newEvent.title);
    const { error } = await supabase.from('events').insert({
      team_id: id,
      title: newEvent.title.trim(),
      type: isGame ? 'game' : 'practice',
      starts_at: when.toISOString(),
      ends_at: new Date(when.getTime() + (isGame ? 90 : 60) * 60000).toISOString(),
      location_name: newEvent.location.trim() || null,
    });
    if (error) return Alert.alert('Could not add event', error.message);
    setNewEvent({ title: '', when: '', location: '' });
    await load();
  }

  async function addMyKid(athleteId: string) {
    await supabase.from('team_athletes').upsert({ team_id: id, athlete_id: athleteId }, { onConflict: 'team_id,athlete_id' });
    await load();
  }

  if (!team) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const groups = groupByDay(events, (e) => new Date(e.starts_at));
  const myKidsNotOnRoster = athletes.filter((a) => !roster.some((r) => r.id === a.id));

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ paddingVertical: space.sm }}>
        <Text color="accent">‹ Back</Text>
      </Pressable>
      <Row>
        <Avatar name={team.name} color={team.color} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="h1">{team.name}</Text>
          <Text variant="small" color="muted">
            {sportLabel[team.sport]}
            {team.season ? ` · ${team.season}` : ''} · {members.length} adults · {roster.length} players
          </Text>
        </View>
      </Row>

      <Card style={{ marginTop: space.lg, backgroundColor: t.accentSoft, borderColor: t.accentSoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="label" color="accent">
              Team code
            </Text>
            <Text variant="display" color="accent" style={{ letterSpacing: 4 }}>
              {team.join_code}
            </Text>
          </View>
          <Button title="Share invite" onPress={share} />
        </Row>
      </Card>

      <Row style={{ marginTop: space.xl }}>
        {(['schedule', 'people', 'settings'] as const).map((k) => (
          <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={tab === k} onPress={() => setTab(k)} />
        ))}
      </Row>

      {tab === 'schedule' ? (
        <View>
          {team.ics_url ? (
            <Row style={{ marginTop: space.lg, justifyContent: 'space-between' }}>
              <Text variant="small" color="muted" style={{ flex: 1 }}>
                {team.ics_last_error
                  ? `Last sync failed: ${team.ics_last_error}`
                  : team.ics_last_synced_at
                    ? `Synced from linked calendar ${new Date(team.ics_last_synced_at).toLocaleString()}`
                    : 'Linked calendar has not synced yet.'}
              </Text>
              <Chip label={syncing ? 'Syncing...' : 'Sync now'} tone="accent" onPress={syncing ? undefined : syncNow} />
            </Row>
          ) : null}
          {events.length === 0 ? (
            <View style={{ marginTop: space.lg }}>
              <Empty
                title="No upcoming events"
                body={isStaff ? 'Paste a schedule link in Settings, or add events below.' : 'The manager has not added the schedule yet.'}
              />
            </View>
          ) : null}
          {groups.map((g) => (
            <View key={g.day.toISOString()} style={{ marginTop: space.lg }}>
              <Text variant="h3" style={{ marginBottom: space.sm }}>
                {dayLabel(g.day)}
              </Text>
              <Stack gap={space.sm}>
                {g.items.map((ev) => (
                  <EventCard key={ev.event_id} ev={ev} athletes={athletes} />
                ))}
              </Stack>
            </View>
          ))}
          {isStaff ? (
            <View style={{ marginTop: space.xl }}>
              <SectionHeader title="Add an event" />
              <Card>
                <Stack>
                  <Input placeholder="Practice, or Game vs Puyallup" value={newEvent.title} onChangeText={(v) => setNewEvent((s) => ({ ...s, title: v }))} />
                  <Input placeholder="2026-09-14 09:30" value={newEvent.when} onChangeText={(v) => setNewEvent((s) => ({ ...s, when: v }))} autoCapitalize="none" />
                  <Input placeholder="Fort Steilacoom Park, Field 3" value={newEvent.location} onChangeText={(v) => setNewEvent((s) => ({ ...s, location: v }))} />
                  <Button title="Add event" kind="secondary" onPress={addEvent} />
                </Stack>
              </Card>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'people' ? (
        <View>
          <SectionHeader title="Players" />
          {roster.length === 0 ? (
            <Text variant="small" color="muted">
              No players yet. Parents add their own kids when they join.
            </Text>
          ) : null}
          <Row style={{ flexWrap: 'wrap' }}>
            {roster.map((a) => (
              <Chip key={a.id} label={`${a.first_name} ${a.last_initial ? a.last_initial + '.' : ''}`} />
            ))}
          </Row>
          {myKidsNotOnRoster.length ? (
            <View style={{ marginTop: space.md }}>
              <Text variant="small" color="muted">
                Add your kid to this roster:
              </Text>
              <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
                {myKidsNotOnRoster.map((a) => (
                  <Chip key={a.id} label={`+ ${a.first_name}`} tone="accent" onPress={() => addMyKid(a.id)} />
                ))}
              </Row>
            </View>
          ) : null}
          <SectionHeader title="Adults" />
          <Stack gap={0}>
            {members.map((m) => (
              <ListRow
                key={m.profile_id}
                leading={<Avatar name={m.profile?.full_name || m.profile?.email || '?'} />}
                title={m.profile?.full_name || m.profile?.email || 'Adult'}
                subtitle={m.role === 'manager' ? 'Manager' : m.role === 'coach' ? 'Coach' : m.profile?.phone ? m.profile.phone : 'Parent'}
              />
            ))}
          </Stack>
          <Text variant="small" color="muted" style={{ marginTop: space.md }}>
            Adults on this team can see each other's names and phone numbers so carpools work. Kids are shown by first name and last initial only.
          </Text>
        </View>
      ) : null}

      {tab === 'settings' ? (
        <View>
          <SectionHeader title="Linked calendar" />
          {isStaff ? <LinkedCalendar team={team} onSaved={load} /> : (
            <Text variant="small" color="muted">
              Only the manager or coach can change the schedule link.
            </Text>
          )}
          <SectionHeader title="Your role" />
          <Text variant="small" color="muted">
            You are a {myRole ?? 'member'} on this team.{' '}
            {isStaff ? 'You can add events, edit the schedule link and remove people.' : 'You can offer rides, request rides and sign up for slots.'}
          </Text>
          <View style={{ marginTop: space.xl }}>
            <Button
              title="Leave team"
              kind="ghost"
              onPress={() =>
                Alert.alert('Leave team?', 'You can rejoin with the code any time.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                      await supabase.from('team_members').delete().eq('team_id', id).eq('profile_id', profile!.id);
                      router.replace('/(tabs)/teams');
                    },
                  },
                ])
              }
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function LinkedCalendar({ team, onSaved }: { team: Team; onSaved: () => Promise<void> }) {
  const [url, setUrl] = useState(team.ics_url ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const clean = url.trim().replace(/^webcal:\/\//i, 'https://') || null;
    const { error } = await supabase.from('teams').update({ ics_url: clean, ics_last_error: null }).eq('id', team.id);
    if (!error && clean) await supabase.functions.invoke('ics-sync', { body: { team_id: team.id } }).catch(() => {});
    setBusy(false);
    if (error) Alert.alert('Could not save', error.message);
    await onSaved();
  }
  return (
    <Stack>
      <Input placeholder="https://... .ics" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl} />
      <Text variant="small" color="muted">
        Paste the subscribe link from TeamSnap, SportsEngine or GameChanger. Events sync every hour and on demand. Manual events you add here are kept.
      </Text>
      <Button title="Save link and sync" kind="secondary" onPress={save} loading={busy} />
    </Stack>
  );
}
