import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { EventCard } from '@/components/event-card';
import { SeasonTab, type FinalGame } from '@/components/team/season-tab';
import { SnackRotation } from '@/components/team/snack-rotation';
import { Trips } from '@/components/team/trips';
import { LinkedCalendar, TeamBrand } from '@/components/team/team-brand';
import { TeamCrest } from '@/components/team-crest';
import { CameraIcon, ChatIcon, ShareIcon, SyncIcon } from '@/components/icons';
import { Avatar, Button, NavBar, Card, Chip, Empty, Input, ListRow, Loading, Row, Screen, SectionHeader, Segments, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, sportLabel, useTheme } from '@/lib/theme';
import type { Athlete, EventType, LeaderRow, MyEvent, Team, TeamMember, TeamRecord } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/** A finished game plus the event it belongs to, from a joined select. */
function nextSaturdayNine() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function TeamSpace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { profile, athletes } = useSession();
  const toast = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState<'schedule' | 'season' | 'people' | 'settings'>('schedule');
  const [record, setRecord] = useState<TeamRecord | null>(null);
  const [results, setResults] = useState<FinalGame[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEvent, setNewEvent] = useState<{ title: string; type: EventType; when: Date; minutes: string; location: string }>({
    title: '',
    type: 'practice',
    when: nextSaturdayNine(),
    minutes: '60',
    location: '',
  });

  const myRole = members.find((m) => m.profile_id === profile?.id)?.role;
  const isStaff = myRole === 'manager' || myRole === 'coach';

  const load = useCallback(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 90);
    const [{ data: tm }, { data: mem }, { data: ta }, { data: ev }, { data: rd }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('team_members').select('*, profile:profiles(*)').eq('team_id', id),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', id),
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from('team_reads').select('last_read_at').eq('team_id', id).eq('profile_id', profile!.id).maybeSingle(),
    ]);
    setTeam(tm as Team);
    setMembers(mem ?? []);
    setRoster((ta ?? []).map((r) => r.athlete));
    setEvents(((ev as MyEvent[]) ?? []).filter((e) => e.team_id === id));
    const [{ data: rec }, { data: fin }, { data: led }] = await Promise.all([
      supabase.rpc('team_record', { p_team_id: id }),
      supabase.from('games').select('*, event:events(starts_at, title)').eq('team_id', id).eq('status', 'final').order('ended_at', { ascending: false }),
      supabase.rpc('team_leaders', { p_team_id: id }),
    ]);
    setRecord((rec ?? [])[0] ?? null);
    setResults((fin as FinalGame[]) ?? []);
    setLeaders(led ?? []);
    const since = (rd as { last_read_at: string } | null)?.last_read_at ?? '1970-01-01';
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('team_id', id).gt('created_at', since).neq('author_id', profile!.id);
    setUnread(count ?? 0);
  }, [id, profile]);

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
      toast('Invite copied. Paste it in the team text thread.');
    }
  }

  async function syncNow() {
    setSyncing(true);
    const { error } = await supabase.functions.invoke('ics-sync', { body: { team_id: id } });
    setSyncing(false);
    if (error) toast(`Sync failed: ${error.message}`, { tone: 'error' });
    else toast('Schedule synced');
    await load();
  }

  async function addEvent() {
    if (!newEvent.title.trim()) return Alert.alert('Give the event a title.');
    const mins = Math.max(15, Number(newEvent.minutes) || 60);
    const { error } = await supabase.from('events').insert({
      team_id: id,
      title: newEvent.title.trim(),
      type: newEvent.type,
      starts_at: newEvent.when.toISOString(),
      ends_at: new Date(newEvent.when.getTime() + mins * 60000).toISOString(),
      location_name: newEvent.location.trim() || null,
    });
    if (error) return toast(error.message, { tone: 'error' });
    setNewEvent((s) => ({ ...s, title: '', location: '' }));
    setAdding(false);
    toast(`${newEvent.title.trim()} added to the schedule`);
    await load();
  }

  async function addMyKid(athleteId: string) {
    await supabase.from('team_athletes').upsert({ team_id: id, athlete_id: athleteId }, { onConflict: 'team_id,athlete_id' });
    toast(`${athletes.find((a) => a.id === athleteId)?.first_name ?? 'Kid'} added to the roster`);
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
  const heroId = events.find((e) => !e.cancelled)?.event_id;

  return (
    <Screen glow>
      <NavBar />
      <Row gap={space.md}>
        <TeamCrest name={team.name} color={team.color} logoPath={team.logo_path} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="h1">{team.name}</Text>
          <Text variant="small" color="muted">
            {sportLabel[team.sport]}
            {team.season ? ` · ${team.season}` : ''} · {members.length} adults · {roster.length} players
          </Text>
        </View>
      </Row>

      <Row style={{ marginTop: space.lg }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Button
            title={unread ? `Chat · ${unread} new` : 'Team chat'}
            icon={<ChatIcon color={t.accentInk} size={20} />}
            onPress={() => router.push({ pathname: '/team/chat', params: { id } })}
          />
        </View>
        <Button title={team.join_code} kind="secondary" icon={<ShareIcon color={t.ink} size={18} />} onPress={share} />
      </Row>
      <Row style={{ marginTop: space.sm }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Button title="Season album" kind="secondary" icon={<CameraIcon color={t.ink} size={18} />} onPress={() => router.push({ pathname: '/team/album', params: { id } })} />
        </View>
      </Row>

      <View style={{ marginTop: space.lg }}>
        <Segments
          value={tab}
          onChange={setTab}
          items={[
            { key: 'schedule', label: 'Schedule' },
            { key: 'season', label: 'Season' },
            { key: 'people', label: 'People' },
            { key: 'settings', label: 'Settings' },
          ]}
        />
      </View>

      {tab === 'schedule' ? (
        <View>
          {team.ics_url ? (
            <Row style={{ marginTop: space.md, justifyContent: 'space-between' }}>
              <Text variant="small" color={team.ics_last_error ? 'signal' : 'faint'} style={{ flex: 1 }}>
                {team.ics_last_error
                  ? `Last sync failed: ${team.ics_last_error}`
                  : team.ics_last_synced_at
                    ? `Synced ${new Date(team.ics_last_synced_at).toLocaleString()}`
                    : 'Linked calendar has not synced yet.'}
              </Text>
              <Button title={syncing ? 'Syncing' : 'Sync'} kind="ghost" size="sm" icon={<SyncIcon color={t.accent} size={16} />} onPress={syncNow} loading={syncing} />
            </Row>
          ) : null}
          {isStaff ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <SnackRotation teamId={id} onDone={load} />
              {!adding ? (
                <Button title="Add an event" kind="secondary" onPress={() => setAdding(true)} />
              ) : (
                <Card raised>
                  <Stack>
                    <Text variant="h3">New event</Text>
                    <Row>
                      {(['practice', 'game', 'tournament', 'other'] as EventType[]).map((k) => (
                        <Chip
                          key={k}
                          label={k[0].toUpperCase() + k.slice(1)}
                          selected={newEvent.type === k}
                          onPress={() => setNewEvent((s) => ({ ...s, type: k, minutes: k === 'game' ? '90' : k === 'tournament' ? '240' : '60' }))}
                        />
                      ))}
                    </Row>
                    <Input
                      label="Title"
                      placeholder={newEvent.type === 'game' ? 'Sharks vs Puyallup' : 'Practice'}
                      value={newEvent.title}
                      onChangeText={(v) => setNewEvent((s) => ({ ...s, title: v }))}
                    />
                    <DateTimeField label="Starts" value={newEvent.when} onChange={(d) => setNewEvent((s) => ({ ...s, when: d }))} />
                    <Row>
                      <View style={{ flex: 1 }}>
                        <Input label="Length (min)" keyboardType="number-pad" value={newEvent.minutes} onChangeText={(v) => setNewEvent((s) => ({ ...s, minutes: v }))} />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Input
                          label="Location"
                          placeholder="Fort Steilacoom Park, Field 4"
                          value={newEvent.location}
                          onChangeText={(v) => setNewEvent((s) => ({ ...s, location: v }))}
                        />
                      </View>
                    </Row>
                    <Row>
                      <View style={{ flex: 1 }}>
                        <Button title="Add to schedule" onPress={addEvent} />
                      </View>
                      <Button title="Cancel" kind="ghost" onPress={() => setAdding(false)} />
                    </Row>
                  </Stack>
                </Card>
              )}
            </View>
          ) : null}
          {events.length === 0 ? (
            <View style={{ marginTop: space.lg }}>
              <Empty title="No upcoming events" body={isStaff ? 'Paste a schedule link in Settings, or add events above.' : 'The manager has not added the schedule yet.'} />
            </View>
          ) : null}
          {groups.map((g) => (
            <View key={g.day.toISOString()} style={{ marginTop: space.xl }}>
              <Text variant="label" color="faint" style={{ marginBottom: space.md }}>
                {dayLabel(g.day).toUpperCase()}
              </Text>
              <Stack gap={space.md}>
                {g.items.map((ev) => (
                  <EventCard key={ev.event_id} ev={ev} athletes={athletes} hero={ev.event_id === heroId} />
                ))}
              </Stack>
            </View>
          ))}
        </View>
      ) : null}

      {/* ---------- Season ---------- */}
      {tab === 'schedule' ? (
        <View style={{ marginTop: space.xl }}>
          <Trips teamId={id} isStaff={isStaff} createdBy={profile!.id} />
        </View>
      ) : null}

      {tab === 'season' ? <SeasonTab team={team} record={record} results={results} leaders={leaders} /> : null}

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
              <Chip
                key={a.id}
                label={`${a.first_name} ${a.last_initial ? a.last_initial + '.' : ''}`}
                dot={a.color}
                onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: a.id } })}
              />
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
          <Text variant="small" color="faint" style={{ marginTop: space.md }}>
            Adults on this team can see each other’s names and phone numbers so carpools work. Kids are shown by first name and last initial only.
          </Text>
        </View>
      ) : null}

      {tab === 'settings' ? (
        <View>
          <SectionHeader title="Team look" />
          {isStaff ? (
            <TeamBrand team={team} onSaved={load} />
          ) : (
            <Text variant="small" color="muted">
              The manager or coach sets the crest and colors.
            </Text>
          )}

          <SectionHeader title="Linked calendar" />
          {isStaff ? (
            <LinkedCalendar team={team} onSaved={load} />
          ) : (
            <Text variant="small" color="muted">
              Only the manager or coach can change the schedule link.
            </Text>
          )}
          <SectionHeader title="Your role" />
          <Text variant="small" color="muted">
            You are a {myRole ?? 'member'} on this team.{' '}
            {isStaff ? 'You can add events, edit the schedule link and remove people.' : 'You can RSVP, offer rides, request rides and sign up for slots.'}
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

// The crest and colors are what make a Team Space feel like the team's, not ours.
// Everything here is optional: a team with no logo still looks finished.
