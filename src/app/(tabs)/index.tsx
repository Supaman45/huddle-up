import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { Button, Empty, Loading, Row, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay, thisWeekRange } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { MyEvent } from '@/lib/types';
import { useSession } from '@/providers/session';

export default function ThisWeek() {
  const { profile, athletes } = useSession();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<MyEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [teamCount, setTeamCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { from, to } = thisWeekRange();
    const [{ data }, { count }] = await Promise.all([
      supabase.rpc('my_events', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.from('team_members').select('*', { count: 'exact', head: true }),
    ]);
    setEvents((data as MyEvent[]) ?? []);
    setTeamCount(count ?? 0);
  }, []);

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

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const needs = events?.filter((e) => e.my_ride_status === 'needs_ride' || e.open_requests > 0).length ?? 0;
  const groups = events ? groupByDay(events, (e) => new Date(e.starts_at)) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
      <Text variant="label" color="accent">
        Huddle Up
      </Text>
      <Text variant="display" style={{ marginTop: 2 }}>
        Hey {firstName}.
      </Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        {events === null
          ? 'Loading the week...'
          : events.length === 0
            ? 'Nothing on the calendar for the next two weeks.'
            : `${events.length} ${events.length === 1 ? 'event' : 'events'} in the next two weeks${needs ? `, ${needs} still need rides` : ''}.`}
      </Text>

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

      {events !== null && teamCount !== 0 && events.length === 0 ? (
        <View style={{ marginTop: space.xl }}>
          <Empty
            title="Quiet fortnight"
            body="Your teams have nothing scheduled yet. If a coach pasted a schedule link, it syncs within the hour. Managers can add events from the team page."
          />
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.day.toISOString()} style={{ marginTop: space.xl }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
            <Text variant="h3">{dayLabel(g.day)}</Text>
            <Text variant="small" color="muted">
              {g.items.length} {g.items.length === 1 ? 'event' : 'events'}
            </Text>
          </Row>
          <Stack gap={space.sm}>
            {g.items.map((ev) => (
              <EventCard key={ev.event_id} ev={ev} athletes={athletes} />
            ))}
          </Stack>
        </View>
      ))}
    </ScrollView>
  );
}
