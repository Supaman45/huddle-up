import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { PinIcon } from '@/components/icons';
import { Button, Card, Chip, Divider, Empty, Loading, NavBar, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { dayLabel, groupByDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { fonts, space, useTheme } from '@/lib/theme';
import type { Athlete, Event, MyEvent, Trip, TripRosterRow } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/**
 * A tournament is one thing to a family: pack Friday, drive, two nights, five games, drive
 * home. To the app it was eleven unrelated calendar entries. This is the container that
 * makes it one thing again.
 *
 * Events are matched by date range rather than moved into the trip, so a game the calendar
 * sync creates next week joins on its own and deleting the trip never orphans a game.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const toast = useToast();
  const { profile, athletes } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [roster, setRoster] = useState<TripRosterRow[]>([]);
  const [mine, setMine] = useState<MyEvent[]>([]);

  const load = useCallback(async () => {
    const { data: tr } = await supabase.from('trips').select('*').eq('id', id).single();
    if (!tr) return;
    setTrip(tr);
    const [{ data: evs }, { data: ros }, { data: my }] = await Promise.all([
      supabase.rpc('trip_events', { p_trip_id: id }),
      supabase.rpc('trip_roster', { p_trip_id: id }),
      supabase.rpc('my_events', {
        p_from: new Date(`${tr.starts_on}T00:00:00`).toISOString(),
        p_to: new Date(`${tr.ends_on}T23:59:59`).toISOString(),
      }),
    ]);
    setEvents(evs ?? []);
    setRoster(ros ?? []);
    setMine(((my as MyEvent[]) ?? []).filter((e) => e.team_id === tr.team_id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setGoing(athlete: Athlete, going: boolean) {
    const { error } = await supabase.from('trip_attendance').upsert(
      { trip_id: id, athlete_id: athlete.id, going, adults: going ? 1 : 0, nights: going ? 1 : 0, set_by: profile!.id, updated_at: new Date().toISOString() },
      { onConflict: 'trip_id,athlete_id' },
    );
    if (error) return toast(error.message, { tone: 'error' });
    toast(going ? `${athlete.first_name} is on the trip` : `${athlete.first_name} is out`, { tone: going ? 'success' : 'signal' });
    await load();
  }

  if (!trip) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const from = parseISO(trip.starts_on);
  const to = parseISO(trip.ends_on);
  const nights = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const going = roster.filter((r) => r.going);
  const beds = going.reduce((n, r) => n + r.adults, 0);
  const myKids = athletes.filter((a) => roster.some((r) => r.athlete_id === a.id));
  const days = groupByDay(mine, (e) => new Date(e.starts_at));

  return (
    <Screen glow>
      <NavBar />
      <Text variant="label" color="accent">
        {nights === 0 ? 'Day trip' : `${nights} ${nights === 1 ? 'night' : 'nights'}`}
      </Text>
      <Text variant="display" style={{ marginTop: 4 }}>
        {trip.name}
      </Text>
      <Text color="muted" style={{ marginTop: 6 }}>
        {format(from, 'EEEE, MMM d')} to {format(to, 'EEEE, MMM d')} · {events.length} {events.length === 1 ? 'game' : 'games'}
      </Text>

      {trip.base_name ? (
        <Card style={{ marginTop: space.lg }}>
          <Row gap={10}>
            <PinIcon color={t.accent} size={20} />
            <View style={{ flex: 1 }}>
              <Text variant="label" color="faint">
                Where the team is staying
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 2 }}>
                {trip.base_name}
              </Text>
            </View>
          </Row>
          {trip.base_url ? (
            <View style={{ marginTop: space.md }}>
              <Button title="Open the booking link" kind="secondary" size="sm" onPress={() => Linking.openURL(trip.base_url!).catch(() => {})} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {trip.notes ? (
        <Card style={{ marginTop: space.sm }}>
          <Text variant="small">{trip.notes}</Text>
        </Card>
      ) : null}

      {/* ---------- Who is going ---------- */}
      <SectionHeader title="Who is going" right={<Chip label={`${going.length} of ${roster.length}`} tone={going.length ? 'accent' : undefined} />} />
      <Card raised>
        <Row style={{ justifyContent: 'space-between' }}>
          {[
            ['Players', going.length],
            ['Adults', beds],
            ['Nights', nights],
          ].map(([label, n]) => (
            <View key={label as string} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 32, color: t.inkStrong }}>{n as number}</Text>
              <Text variant="label" color="faint">
                {label as string}
              </Text>
            </View>
          ))}
        </Row>
        <Text variant="small" color="faint" style={{ marginTop: space.md }}>
          Enough for a manager to hold rooms without chasing a spreadsheet.
        </Text>
      </Card>

      {myKids.length ? (
        <Stack gap={space.sm} style={{ marginTop: space.md }}>
          {myKids.map((k) => {
            const row = roster.find((r) => r.athlete_id === k.id);
            return (
              <Card key={k.id} rail={row?.going ? t.accent : k.color} style={{ paddingLeft: space.xl }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyBold">{k.first_name}</Text>
                  <Row gap={6}>
                    <Chip label="Coming" selected={row?.going === true} onPress={() => setGoing(k, true)} />
                    <Chip label="Staying home" selected={row?.going === false} onPress={() => setGoing(k, false)} />
                  </Row>
                </Row>
              </Card>
            );
          })}
        </Stack>
      ) : null}

      {going.length ? (
        <Row style={{ marginTop: space.md, flexWrap: 'wrap' }} gap={6}>
          {going.map((r) => (
            <Chip key={r.athlete_id} label={r.first_name} dot={r.color} />
          ))}
        </Row>
      ) : null}

      {/* ---------- The days ---------- */}
      <SectionHeader title="The weekend" />
      {days.length === 0 ? <Empty title="No games yet" body="When the schedule lands, every game inside these dates shows up here automatically." /> : null}
      {days.map((g) => (
        <View key={g.day.toISOString()} style={{ marginTop: space.lg }}>
          <Text variant="label" color="faint" style={{ marginBottom: space.md }}>
            {dayLabel(g.day).toUpperCase()} · {format(g.day, 'EEE MMM d').toUpperCase()}
          </Text>
          <Stack gap={space.md}>
            {g.items.map((ev) => (
              <EventCard key={ev.event_id} ev={ev} athletes={athletes} />
            ))}
          </Stack>
        </View>
      ))}

      <Divider />
      <Text variant="small" color="faint" style={{ marginTop: space.md }}>
        Games are matched to these dates rather than moved into the trip, so anything the calendar sync adds later joins on its own.
      </Text>
    </Screen>
  );
}
