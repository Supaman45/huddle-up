import { addMonths, format, isSameDay, isToday, startOfDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { BellIcon } from '@/components/icons';
import { MonthGrid } from '@/components/month-grid';
import { OfflineNote } from '@/components/offline-note';
import { Avatar, Button, Chip, Empty, Glow, Loading, Row, Segments, Stack, Text } from '@/components/ui';
import { readCache, writeCache } from '@/lib/cache';
import { headline } from '@/lib/headline';
import { dayLabel, groupByDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { fonts, space, useTheme } from '@/lib/theme';
import type { MyEvent } from '@/lib/types';
import { useLive } from '@/providers/live';
import { useSession } from '@/providers/session';

const CACHE_KEY = 'my-events';

export default function ThisWeek() {
  const { profile, athletes } = useSession();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<MyEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [news, setNews] = useState(0);
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [kidFilter, setKidFilter] = useState<string | null>(null);
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const from = addMonths(startOfDay(new Date()), -2);
    const to = addMonths(from, 14);

    // Fields have one bar. Show what we saw last, immediately, then correct it.
    // Guarded by a ref, not by reading `events`: depending on state that this function also
    // sets makes `load` a new function on every fetch, which makes the focus effect re-fire,
    // which fetches again. That is an infinite refetch loop, and it is invisible until you
    // look at the network tab or the bill.
    if (!hydrated.current) {
      hydrated.current = true;
      const cached = await readCache<MyEvent[]>(CACHE_KEY);
      if (cached) {
        setEvents(cached.value);
        setTeamCount(cached.value.length ? 1 : 0);
      }
    }

    const [{ data, error }, { count }, { data: unread }] = await Promise.all([
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id),
      supabase.rpc('unread_activity'),
    ]);

    if (error) {
      // Keep whatever is on screen and say how old it is, rather than blanking the schedule
      // in the one moment a parent needs it.
      const cached = await readCache<MyEvent[]>(CACHE_KEY);
      if (cached) {
        setEvents(cached.value);
        setStaleAt(cached.at);
      }
      return;
    }

    const rows = (data as MyEvent[]) ?? [];
    setStaleAt(null);
    setEvents(rows);
    setTeamCount(count ?? 0);
    setNews((unread as number) ?? 0);
    await writeCache(CACHE_KEY, rows);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLive(load);

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
          <Row gap={space.md}>
            <Pressable
              onPress={() => router.push('/activity')}
              accessibilityLabel={news ? `What changed, ${news} new` : 'What changed'}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <BellIcon color={news ? t.signal : t.muted} size={22} />
              {news ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    paddingHorizontal: 4,
                    backgroundColor: t.signal,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: t.bg,
                  }}>
                  <Text style={{ fontSize: 10, lineHeight: 12, color: t.accentInk, fontFamily: fonts.displayBold }}>{news > 9 ? '9+' : news}</Text>
                </View>
              ) : null}
            </Pressable>
            <Avatar name={profile?.full_name || profile?.email || '?'} size={34} />
          </Row>
        </Row>
        <Text variant="display" style={{ marginTop: space.md }}>
          {h.big}
        </Text>
        <Text color="muted" style={{ marginTop: 6 }}>
          {h.sub}
        </Text>
        {staleAt ? <OfflineNote at={staleAt} /> : null}

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
                    <EventCard key={ev.event_id} ev={ev} athletes={athletes} hero={ev.event_id === heroId} />
                  ))}
                </Stack>
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}
