import { format, isToday, isTomorrow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { Avatar, Button, Chip, Empty, Glow, Loading, Row, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay, thisWeekRange } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { MyEvent } from '@/lib/types';
import { useSession } from '@/providers/session';

function headline(events: MyEvent[] | null): { big: string; sub: string } {
  if (!events) return { big: 'Loading', sub: 'Pulling in the week.' };
  const upcoming = events.filter((e) => !e.cancelled);
  const next = upcoming[0];
  if (!next) return { big: 'Quiet week.', sub: 'Nothing on the calendar for the next two weeks.' };
  const d = new Date(next.starts_at);
  const when = isToday(d) ? 'today' : isTomorrow(d) ? 'tomorrow' : format(d, 'EEEE');
  const rides = upcoming.filter((e) => e.my_ride_status === 'needs_ride').length;
  const unanswered = upcoming.reduce((n, e) => n + e.athlete_ids.filter((id) => !e.my_rsvps?.[id]).length, 0);
  const nextGame = upcoming.find((e) => e.type === 'game');
  const big = nextGame ? `Game day\n${isToday(new Date(nextGame.starts_at)) ? 'today.' : isTomorrow(new Date(nextGame.starts_at)) ? 'tomorrow.' : format(new Date(nextGame.starts_at), 'EEEE') + '.'}` : `${next.type === 'practice' ? 'Practice' : 'Next up'}\n${when}.`;
  const parts: string[] = [`${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'} in the next two weeks`];
  if (rides) parts.push(`${rides} still ${rides === 1 ? 'needs' : 'need'} a ride`);
  if (unanswered) parts.push(`${unanswered} RSVP${unanswered === 1 ? '' : 's'} waiting on you`);
  return { big, sub: parts.join('. ') + '.' };
}

export default function ThisWeek() {
  const { profile, athletes } = useSession();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<MyEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [kidFilter, setKidFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { from, to } = thisWeekRange();
    const [{ data }, { count }] = await Promise.all([
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('profile_id', profile?.id ?? ''),
    ]);
    setEvents((data as MyEvent[]) ?? []);
    setTeamCount(count ?? 0);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const visible = useMemo(() => (events ?? []).filter((e) => !kidFilter || e.athlete_ids.includes(kidFilter)), [events, kidFilter]);
  const h = headline(visible.length || !events ? visible : events);
  const groups = groupByDay(visible, (e) => new Date(e.starts_at));
  const heroId = visible.find((e) => !e.cancelled)?.event_id;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Glow />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="label" color="accent">
            Huddle Up
          </Text>
          <Avatar name={profile?.full_name || profile?.email || '?'} size={34} />
        </Row>
        <Text variant="display" style={{ marginTop: space.md }}>
          {h.big}
        </Text>
        <Text color="muted" style={{ marginTop: 6 }}>
          {h.sub}
        </Text>

        {athletes.length > 1 ? (
          <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
            <Chip label="All kids" selected={!kidFilter} onPress={() => setKidFilter(null)} />
            {athletes.map((a) => (
              <Chip key={a.id} label={a.first_name} dot={a.color} selected={kidFilter === a.id} onPress={() => setKidFilter(kidFilter === a.id ? null : a.id)} />
            ))}
          </Row>
        ) : null}

        {events === null ? <Loading /> : null}

        {events !== null && teamCount === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Empty
              title="Join your first team"
              body="Got a code from a coach or team parent? Enter it. Running the team yourself? Create a Team Space and paste the schedule link from TeamSnap, SportsEngine or GameChanger."
              action={
                <Stack gap={space.sm}>
                  <Button title="Enter a team code" onPress={() => router.push('/team/join')} />
                  <Button title="Create a Team Space" kind="secondary" onPress={() => router.push('/team/new')} />
                </Stack>
              }
            />
          </View>
        ) : null}

        {events !== null && teamCount !== 0 && visible.length === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Empty title="Nothing scheduled" body={kidFilter ? 'Nothing for this kid in the next two weeks.' : 'If a coach pasted a schedule link, it syncs within the hour. Managers can add events from the team page.'} />
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.day.toISOString()} style={{ marginTop: space.xl }}>
            <Text variant="label" color="faint" style={{ marginBottom: space.md }}>
              {dayLabel(g.day).toUpperCase()} · {format(g.day, 'EEE MMM d').toUpperCase()}
            </Text>
            <Stack gap={space.md}>
              {g.items.map((ev) => (
                <EventCard key={ev.event_id} ev={ev} athletes={athletes} hero={ev.event_id === heroId} onChanged={load} />
              ))}
            </Stack>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
