import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DriverCard } from '@/components/driver-card';
import { CarIcon } from '@/components/icons';
import { Avatar, Button, Chip, Empty, Glow, Loading, Row, Segments, Stack, Text } from '@/components/ui';
import {
  askableAthleteIds,
  eventState,
  kidName,
  matchesFilter,
  myCars,
  openAsks,
  seatsLeft,
  stateLine,
  summarize,
  type DashFilter,
  type EventState,
} from '@/lib/carpool-dash';
import { dayLabel, groupByDay, timeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { CarpoolAsk, CarpoolEvent } from '@/lib/types';
import { useLive } from '@/providers/live';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const DAYS = 21;

/**
 * The carpool board for every team a parent belongs to, three weeks out.
 *
 * This is where ride information lives, so the schedule can stay a schedule. Each event shows
 * who is still waiting, which cars are going, who is in each one, and how to reach the adult
 * driving. Actions here are the short ones that do not need a form: take a rider into your
 * car, let one go, ask for a seat for your own kid. Offering a car needs seats, direction and
 * a note, so that still opens the event.
 */
export default function Carpool() {
  const { profile, athletes } = useSession();
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<CarpoolEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<DashFilter>('all');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase.rpc('my_carpool', { p_days: DAYS });
    if (error) return;
    // jsonb arrives as Json; the RPC builds exactly these shapes, see my_carpool_dashboard.
    setEvents((data ?? []) as unknown as CarpoolEvent[]);
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

  const openEvent = (id: string) => router.push({ pathname: '/event/[id]', params: { id } });

  // ---------- Actions ----------
  async function takeRider(ev: CarpoolEvent, ask: CarpoolAsk) {
    const car = myCars(ev).find((c) => seatsLeft(c) > 0);
    if (!car) return toast('Your car is full.', { tone: 'signal' });
    const { error } = await supabase.from('carpool_requests').update({ offer_id: car.id, status: 'matched' }).eq('id', ask.id);
    if (error) return toast(error.message, { tone: 'error' });
    toast(`${ask.first_name} is in your car. ${ask.requester_name.split(' ')[0]} has been told.`);
    load();
  }

  async function releaseRider(requestId: string, firstName: string) {
    const { error } = await supabase.from('carpool_requests').update({ offer_id: null, status: 'open' }).eq('id', requestId);
    if (error) return toast(error.message, { tone: 'error' });
    toast(`${firstName} needs a ride again`, { tone: 'signal' });
    load();
  }

  async function askForRide(ev: CarpoolEvent, athleteId: string) {
    if (!profile) return;
    const { error } = await supabase.from('carpool_requests').insert({ event_id: ev.event_id, athlete_id: athleteId, requested_by: profile.id, direction: 'both' });
    if (error && !error.message.includes('duplicate')) return toast(error.message, { tone: 'error' });
    const kid = athletes.find((a) => a.id === athleteId)?.first_name ?? 'Kid';
    toast(`Ride requested for ${kid}. Drivers on the team can see it now.`);
    load();
  }

  async function cancelAsk(ask: CarpoolAsk) {
    const { error } = await supabase.from('carpool_requests').delete().eq('id', ask.id);
    if (error) return toast(error.message, { tone: 'error' });
    toast(`${ask.first_name} no longer needs a ride`, { tone: 'signal' });
    load();
  }

  // ---------- Derived ----------
  const shown = useMemo(() => (events ?? []).filter((ev) => matchesFilter(ev, filter)), [events, filter]);
  const groups = groupByDay(shown, (e) => new Date(e.starts_at));
  const sum = summarize(events ?? []);
  const needsCount = (events ?? []).filter((ev) => openAsks(ev).length > 0).length;

  const headline =
    sum.mineWaiting > 0
      ? `${sum.mineWaiting === 1 ? 'One of your kids' : `${sum.mineWaiting} of your kids`} still ${sum.mineWaiting === 1 ? 'needs' : 'need'} a ride.`
      : sum.waiting > 0
        ? `${sum.waiting} ${sum.waiting === 1 ? 'kid needs' : 'kids need'} a ride this month.`
        : sum.driving > 0
          ? `You're driving ${sum.driving === 1 ? 'once' : `${sum.driving} times`}. Everyone else is set.`
          : 'Everyone has a ride.';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Glow />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
        <Text variant="label" color="accent">
          Carpool
        </Text>
        <Text variant="h1" style={{ marginTop: space.md }}>
          {headline}
        </Text>

        {/* One glance: the three numbers that matter across every team. */}
        {events && events.length ? (
          <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
            {sum.waiting ? <Chip label={`${sum.waiting} waiting`} tone="signal" /> : null}
            <Chip label={`${sum.seats} ${sum.seats === 1 ? 'seat' : 'seats'} open`} tone={sum.seats ? 'accent' : undefined} />
            {sum.driving ? <Chip label={`Driving ${sum.driving}×`} tone="accent" /> : null}
            {sum.riding ? <Chip label={`${sum.riding} ${sum.riding === 1 ? 'ride' : 'rides'} set`} tone="accent" /> : null}
          </Row>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          <Segments
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All' },
              { key: 'needs', label: 'Needs a ride', badge: needsCount || undefined },
              { key: 'mine', label: 'Mine' },
            ]}
          />
        </View>

        {events === null ? <Loading /> : null}

        {events !== null && events.length === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Empty title="No events in the next three weeks" body="Carpools show up here once a team has something on the schedule." />
          </View>
        ) : null}

        {events !== null && events.length > 0 && shown.length === 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Empty title={filter === 'needs' ? 'Nobody is waiting' : 'Nothing of yours here'} body={filter === 'needs' ? 'Every kid who asked has a seat.' : 'Events your kids play, or where you are driving or riding, show up here.'} />
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.day.toISOString()} style={{ marginTop: space.xl }}>
            <Text variant="label" color="faint" style={{ marginBottom: space.md }}>
              {dayLabel(g.day).toUpperCase()} · {format(g.day, 'EEE MMM d').toUpperCase()}
            </Text>
            <Stack gap={space.md}>
              {g.items.map((ev) => (
                <EventBoard
                  key={ev.event_id}
                  ev={ev}
                  athleteName={(id) => athletes.find((a) => a.id === id)?.first_name ?? 'Kid'}
                  onOpen={() => openEvent(ev.event_id)}
                  onTake={(ask) => takeRider(ev, ask)}
                  onRelease={releaseRider}
                  onAsk={(athleteId) => askForRide(ev, athleteId)}
                  onCancelAsk={cancelAsk}
                />
              ))}
            </Stack>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const pillTone: Record<EventState, 'signal' | 'accent' | undefined> = {
  my_kid_waiting: 'signal',
  kids_waiting: 'signal',
  im_driving: 'accent',
  settled: 'accent',
  quiet: undefined,
};

const pillLabel: Record<EventState, string> = {
  my_kid_waiting: 'Needs ride',
  kids_waiting: 'Can help',
  im_driving: 'Driving',
  settled: 'Set',
  quiet: 'Open',
};

function EventBoard({
  ev,
  athleteName,
  onOpen,
  onTake,
  onRelease,
  onAsk,
  onCancelAsk,
}: {
  ev: CarpoolEvent;
  athleteName: (id: string) => string;
  onOpen: () => void;
  onTake: (ask: CarpoolAsk) => void;
  onRelease: (requestId: string, firstName: string) => void;
  onAsk: (athleteId: string) => void;
  onCancelAsk: (ask: CarpoolAsk) => void;
}) {
  const t = useTheme();
  const state = eventState(ev);
  const waiting = openAsks(ev);
  const mine = myCars(ev);
  const iHaveRoom = mine.some((c) => seatsLeft(c) > 0);
  const askable = askableAthleteIds(ev);
  const rail = state === 'my_kid_waiting' || state === 'kids_waiting' ? t.signal : state === 'im_driving' || state === 'settled' ? t.accent : ev.team_color;

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.line,
        padding: space.lg,
        paddingLeft: space.xl,
        gap: space.md,
        overflow: 'hidden',
      }}>
      <View style={{ position: 'absolute', left: 0, top: space.lg, bottom: space.lg, width: 4, borderRadius: 2, backgroundColor: rail }} />

      {/* Header: what and when. Tapping goes to the event for RSVPs, snacks, the offer form. */}
      <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="mono" color="muted">
              {timeLabel(new Date(ev.starts_at)).toUpperCase()}
            </Text>
            <Text variant="h3">{ev.title}</Text>
            <Text variant="small" color="muted">
              {ev.team_name}
              {ev.location_name ? ` · ${ev.location_name}` : ''}
            </Text>
          </View>
          <Chip label={pillLabel[state]} tone={pillTone[state]} />
        </Row>
        <Row gap={8} style={{ marginTop: space.sm }}>
          <CarIcon color={rail} size={18} />
          <Text variant="small" color={state === 'my_kid_waiting' || state === 'kids_waiting' ? 'signal' : 'muted'}>
            {stateLine(ev, state)}
          </Text>
        </Row>
      </Pressable>

      {/* ---------- Waiting ---------- */}
      {waiting.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" color="signal">
            Needs a ride
          </Text>
          {waiting.map((ask) => (
            <Row key={ask.id} style={{ justifyContent: 'space-between' }}>
              <Row gap={10} style={{ flex: 1 }}>
                <Avatar name={ask.first_name} color={ask.color} size={30} ring={ask.mine ? t.signal : undefined} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{kidName(ask)}</Text>
                  <Text variant="small" color="muted">
                    {ask.mine ? 'Your request' : `Asked by ${ask.requester_name}`}
                  </Text>
                </View>
              </Row>
              {ask.mine ? (
                <Chip label="Cancel" onPress={() => onCancelAsk(ask)} />
              ) : iHaveRoom ? (
                <Button title="Take" size="sm" onPress={() => onTake(ask)} />
              ) : null}
            </Row>
          ))}
        </View>
      ) : null}

      {/* ---------- Cars ---------- */}
      {ev.offers.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" color="faint">
            {ev.offers.length === 1 ? 'Car' : 'Cars'}
          </Text>
          {ev.offers.map((car) => (
            <DriverCard key={car.id} car={car} eventTitle={ev.title} onManage={car.mine ? onOpen : undefined} onRelease={car.mine ? onRelease : undefined} />
          ))}
        </View>
      ) : null}

      {/* ---------- My next move ---------- */}
      {askable.length || mine.length === 0 ? (
        <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
          {askable.map((id) => (
            <Chip key={id} label={`Ride for ${athleteName(id)}`} tone="signal" onPress={() => onAsk(id)} />
          ))}
          {/* Never offered to a parent whose own kid is waiting: if they could drive, they would. */}
          {mine.length === 0 && state !== 'my_kid_waiting' ? <Chip label="I can drive" tone="accent" onPress={onOpen} /> : null}
        </Row>
      ) : null}
    </View>
  );
}
