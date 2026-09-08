import { addMonths, format, isSameDay, isToday, isTomorrow, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { MonthGrid } from '@/components/month-grid';
import { Avatar, Button, Chip, Empty, Glow, Loading, Row, Segments, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { MyEvent } from '@/lib/types';
import { useSession } from '@/providers/session';

function headline(events: MyEvent[]): { big: string; sub: string } {
  const upcoming = events.filter((e) => !e.cancelled && new Date(e.starts_at) >= startOfDay(new Date()));
  const next = upcoming[0];
  if (!next) return { big: 'Quiet week.', sub: 'Nothing on the calendar coming up.' };
  const rides = upcoming.filter((e) => e.my_ride_status === 'needs_ride').length;
  const unanswered = upcoming.reduce((n, e) => n + e.athlete_ids.filter((id) => !e.my_rsvps?.[id]).length, 0);
  const nextGame = upcoming.find((e) => e.type === 'game');
  const when = (d: Date) => (isToday(d) ? 'today.' : isTomorrow(d) ? 'tomorrow.' : `${format(d, 'EEEE')}.`);
  const big = nextGame
    ? `Game day\n${when(new Date(nextGame.starts_at))}`
    : `${next.type === 'practice' ? 'Practice' : 'Next up'}\n${when(new Date(next.starts_at))}`;
  const parts = [`${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'} coming up`];
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
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const load = useCallback(async () => {
    if (!profile) return;
    const from = addMonths(startOfDay(new Date()), -2);
    const to = addMonths(from, 14);
    const [{ data }, { count }] = await Promise.all([
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id),
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

  const all = useMemo(() => (events ?? []).filter((e) => !kidFilter || e.athlete_ids.includes(kidFilter)), [events, kidFilter]);
  const upcoming = useMemo(() => all.filter((e) => new Date(e.starts_at) >= startOfDay(new Date())), [all]);
  const h = headline(all);
  const agendaGroups = groupByDay(upcoming.slice(0, 40), (e) => new Date(e.starts_at));
  const heroId = upcoming.find((e) => !e.cancelled)?.event_id;
  const dayEvents = all.filter((e) => isSameDay(new Date(e.starts_at), selected));

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

        <View style={{ marginTop: space.lg }}>
          <Segments
            value={view}
            onChange={(v) => {
              setView(v);
              if (v === 'month') {
                setMonth(new Date());
                setSelected(startOfDay(new Date()));
              }
            }}
            items={[
              { key: 'agenda', label: 'Next up' },
              { key: 'month', label: 'Month' },
            ]}
          />
        </View>

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

        {/* ---------- Month ---------- */}
        {view === 'month' && events !== null && teamCount !== 0 ? (
          <View style={{ marginTop: space.lg }}>
            <MonthGrid month={month} onMonthChange={setMonth} selected={selected} onSelect={setSelected} events={all} athletes={athletes} />
            <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md }}>
              <Text variant="label" color="faint">
                {dayLabel(selected).toUpperCase()} · {format(selected, 'MMM d').toUpperCase()}
              </Text>
              {!isToday(selected) ? (
                <Chip
                  label="Today"
                  onPress={() => {
                    setSelected(startOfDay(new Date()));
                    setMonth(new Date());
                  }}
                />
              ) : null}
            </Row>
            {dayEvents.length === 0 ? (
              <Text variant="small" color="faint">
                Nothing on this day.
              </Text>
            ) : (
              <Stack gap={space.md}>
                {dayEvents.map((ev) => (
                  <EventCard key={ev.event_id} ev={ev} athletes={athletes} />
                ))}
              </Stack>
            )}
          </View>
        ) : null}

        {/* ---------- Agenda ---------- */}
        {view === 'agenda' && events !== null && teamCount !== 0 && upcoming.length === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Empty
              title="Nothing scheduled"
              body={kidFilter ? 'Nothing for this kid coming up.' : 'If a coach pasted a schedule link, it syncs within the hour. Managers can add events from the team page.'}
            />
          </View>
        ) : null}

        {view === 'agenda'
          ? agendaGroups.map((g) => (
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
            ))
          : null}
      </ScrollView>
    </View>
  );
}
