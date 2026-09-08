import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { Avatar, Button, Card, Chip, Row, Text } from '@/components/ui';
import { rangeLabel, timeLabel } from '@/lib/dates';
import { radius, space, useTheme } from '@/lib/theme';
import { rideState } from '@/lib/carpool';
import type { Athlete, MyEvent } from '@/lib/types';
import { useAnimatedValue } from '@/lib/animation';
import { useEventChangedAt } from '@/providers/live';

const typeLabel: Record<string, string> = { game: 'Game', practice: 'Practice', tournament: 'Tournament', other: 'Event' };

// hero: the next-up card gets the raised treatment and the accent rail.
export function EventCard({ ev, athletes, hero = false }: { ev: MyEvent; athletes: Athlete[]; hero?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const kids = athletes.filter((a) => ev.athlete_ids.includes(a.id));
  const state = rideState(ev);
  const urgent = state === 'waiting' || state === 'can_help';
  const settled = state === 'matched' || state === 'driving_full' || state === 'driving_open';
  const rail = ev.cancelled ? t.faint : urgent ? t.signal : settled ? t.accent : (kids[0]?.color ?? ev.team_color);
  const open = () => router.push({ pathname: '/event/[id]', params: { id: ev.event_id } });
  const arriveAt = new Date(start.getTime() - 30 * 60000);
  const unansweredMine = kids.filter((k) => !ev.my_rsvps?.[k.id]).length;

  // The whole point of a matched ride is reaching the driver on Saturday morning.
  // A change that arrives while you are looking at the screen should be seen, not just be
  // true. One slow pulse of the rail colour: enough to catch the eye across a kitchen, not
  // enough to be a toy. It never fires on first render, only when this event actually moved.
  const changedAt = useEventChangedAt(ev.event_id);
  const seenChange = useRef(changedAt);
  const flash = useAnimatedValue(0);
  useEffect(() => {
    // Seeded with the value at mount, so a card that renders after a change does not flash
    // for something the parent has already seen. Only a change that lands while they are
    // looking gets a pulse.
    if (changedAt === seenChange.current) return;
    seenChange.current = changedAt;
    if (changedAt === undefined) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 1400, useNativeDriver: false }),
    ]).start();
  }, [changedAt, flash]);

  // Ride detail lives on the Carpool tab. The card carries one pill, and the pill goes there.
  const toCarpool = () => router.push('/carpool');

  return (
    <Animated.View
      style={{
        borderRadius: radius.lg,
        backgroundColor: flash.interpolate({ inputRange: [0, 1], outputRange: ['transparent', rail] }),
        padding: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }),
      }}>
      <Card rail={rail} raised={hero} style={{ paddingLeft: space.xl, gap: 10, opacity: ev.cancelled ? 0.6 : 1 }}>
      <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => ({ gap: 10, opacity: pressed ? 0.85 : 1 })}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="mono" color={hero ? 'accent' : 'muted'}>
              {rangeLabel(start, end).toUpperCase()}
            </Text>
            <Text variant={hero ? 'h1' : 'h2'} style={{ textDecorationLine: ev.cancelled ? 'line-through' : 'none' }}>
              {ev.title}
            </Text>
            <Text variant="small" color="muted">
              {ev.team_name}
              {ev.location_name ? ` · ${ev.location_name}` : ''}
            </Text>
          </View>
          {ev.cancelled ? (
            <Chip label="Cancelled" tone="signal" />
          ) : state === 'waiting' ? (
            <Chip label="Needs ride" tone="signal" onPress={toCarpool} />
          ) : state === 'can_help' ? (
            <Chip label={`${ev.open_requests} need ${ev.open_requests === 1 ? 'a ride' : 'rides'}`} tone="signal" onPress={toCarpool} />
          ) : state === 'matched' ? (
            <Chip label={ev.ride_driver ? `With ${ev.ride_driver.split(' ')[0]}` : 'Ride set'} tone="accent" onPress={toCarpool} />
          ) : state === 'driving_open' || state === 'driving_full' ? (
            <Chip label="Driving" tone="accent" onPress={toCarpool} />
          ) : ev.type === 'game' ? (
            <Chip label={`Arrive ${timeLabel(arriveAt)}`} tone="accent" />
          ) : (
            <Chip label={typeLabel[ev.type]} tone="accent" />
          )}
        </Row>

        <View style={{ height: 1, backgroundColor: t.lineStrong }} />

        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" color="muted">
            {ev.going > 0 ? `${ev.going} going` : 'No RSVPs yet'}
            {ev.open_slots > 0 ? `  ·  ${ev.open_slots} ${ev.open_slots === 1 ? 'slot' : 'slots'} open` : ''}
          </Text>
          <Row gap={0}>
            {kids.map((k, i) => (
              <View key={k.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar name={k.first_name} color={k.color} uri={k.photo_url} size={26} ring={hero ? t.surfaceAlt : t.surface} />
              </View>
            ))}
          </Row>
        </Row>
      </Pressable>

      {hero && !ev.cancelled ? (
        <Row gap={8} style={{ marginTop: 2 }}>
          {/* One row, two buttons: the RSVP that is owed, and the details. Ride actions are on the Carpool tab. */}
          <View style={{ flex: 1 }}>
            <Button
              title={
                unansweredMine > 0
                  ? `RSVP ${unansweredMine === 1 ? (kids.find((k) => !ev.my_rsvps?.[k.id])?.first_name ?? '') : `${unansweredMine} kids`}`
                  : ev.open_slots > 0
                    ? `Snacks: ${ev.open_slots} open`
                    : 'See who is going'
              }
              kind={unansweredMine > 0 ? 'primary' : 'secondary'}
              size="sm"
              onPress={open}
            />
          </View>
          {urgent ? (
            <View style={{ flex: 1 }}>
              <Button title="Carpool" kind="signal" size="sm" onPress={toCarpool} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Button title="Details" kind="secondary" size="sm" onPress={open} />
            </View>
          )}
        </Row>
      ) : null}
      </Card>
    </Animated.View>
  );
}
