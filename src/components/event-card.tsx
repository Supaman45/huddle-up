import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, View } from 'react-native';

import { CarIcon } from '@/components/icons';
import { Avatar, Button, Card, Chip, Row, Text } from '@/components/ui';
import { rangeLabel, timeLabel } from '@/lib/dates';
import { space, useTheme } from '@/lib/theme';
import type { Athlete, MyEvent } from '@/lib/types';

const typeLabel: Record<string, string> = { game: 'Game', practice: 'Practice', tournament: 'Tournament', other: 'Event' };

// A carpool has two people with opposite jobs. The parent who needs a ride wants certainty:
// did anyone take it, who, and how do I reach them. The parent with seats wants a target:
// how many kids need a ride and can I grab one on the way. Orange means unresolved and
// someone has to act. Green means settled. Nothing else earns a color.
type RideState = 'driving_open' | 'driving_full' | 'matched' | 'waiting' | 'can_help' | 'quiet';

function rideState(ev: MyEvent): RideState {
  if (ev.my_ride_status === 'driving') return (ev.my_seats_open ?? 0) > 0 ? 'driving_open' : 'driving_full';
  if (ev.my_ride_status === 'matched') return 'matched';
  if (ev.my_ride_status === 'needs_ride') return 'waiting';
  if (ev.open_requests > 0) return 'can_help';
  return 'quiet';
}

function rideLine(ev: MyEvent, state: RideState): string {
  const seats = ev.seats_open;
  switch (state) {
    case 'driving_open':
      return `You're driving · ${ev.my_seats_open} ${ev.my_seats_open === 1 ? 'seat' : 'seats'} left`;
    case 'driving_full':
      return `You're driving · car full`;
    case 'matched':
      return ev.ride_driver ? `Riding with ${ev.ride_driver}` : 'Ride set';
    case 'waiting':
      return seats > 0 ? `Waiting on a driver · ${seats} ${seats === 1 ? 'seat' : 'seats'} open` : 'Waiting on a driver';
    case 'can_help':
      return `${ev.open_requests} ${ev.open_requests === 1 ? 'kid needs' : 'kids need'} a ride`;
    default:
      return ev.offers > 0 ? `${ev.offers} ${ev.offers === 1 ? 'car' : 'cars'} going` : 'No carpools yet';
  }
}

// hero: the next-up card gets the raised treatment and the accent rail.
export function EventCard({ ev, athletes, hero = false, onChanged }: { ev: MyEvent; athletes: Athlete[]; hero?: boolean; onChanged?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const kids = athletes.filter((a) => ev.athlete_ids.includes(a.id));
  const state = rideState(ev);
  const urgent = state === 'waiting' || state === 'can_help';
  const settled = state === 'matched' || state === 'driving_full' || state === 'driving_open';
  const rail = ev.cancelled ? t.faint : urgent ? t.signal : settled ? t.accent : kids[0]?.color ?? ev.team_color;
  const open = () => router.push({ pathname: '/event/[id]', params: { id: ev.event_id } });
  const arriveAt = new Date(start.getTime() - 30 * 60000);
  const unansweredMine = kids.filter((k) => !ev.my_rsvps?.[k.id]).length;

  // The whole point of a matched ride is reaching the driver on Saturday morning.
  const canText = state === 'matched' && !!ev.ride_driver_phone;
  function textDriver() {
    const num = (ev.ride_driver_phone ?? '').replace(/[^\d+]/g, '');
    const body = encodeURIComponent(`Hi ${ev.ride_driver}, checking on the ride to ${ev.title}.`);
    Linking.openURL(Platform.OS === 'ios' ? `sms:${num}&body=${body}` : `sms:${num}?body=${body}`).catch(() => {});
  }

  return (
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
            <Chip label="Needs ride" tone="signal" />
          ) : state === 'can_help' ? (
            <Chip label={`${ev.open_requests} need ${ev.open_requests === 1 ? 'a ride' : 'rides'}`} tone="signal" />
          ) : ev.type === 'game' ? (
            <Chip label={`Arrive ${timeLabel(arriveAt)}`} tone="accent" />
          ) : (
            <Chip label={typeLabel[ev.type]} tone="accent" />
          )}
        </Row>

        <View style={{ height: 1, backgroundColor: t.lineStrong }} />

        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10} style={{ flex: 1 }}>
            <CarIcon color={urgent ? t.signal : settled ? t.accent : t.faint} size={20} />
            <Text variant="small" style={{ flex: 1 }} color={urgent ? 'signal' : undefined}>
              {rideLine(ev, state)}
              {ev.going > 0 ? <Text variant="small" color="muted">{`  ·  ${ev.going} going`}</Text> : null}
            </Text>
          </Row>
          <Row gap={0}>
            {kids.map((k, i) => (
              <View key={k.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar name={k.first_name} color={k.color} size={26} ring={hero ? t.surfaceAlt : t.surface} />
              </View>
            ))}
          </Row>
        </Row>

        {/* The pickup note is the practical half of a matched ride: where and when. */}
        {state === 'matched' && ev.ride_note ? (
          <Text variant="small" color="muted" style={{ marginLeft: 30 }}>
            {ev.ride_note}
          </Text>
        ) : null}
      </Pressable>

      {hero && !ev.cancelled ? (
        <Row gap={8} style={{ marginTop: 2 }}>
          {/* The first button is whatever this parent's next move actually is. */}
          {state === 'can_help' ? (
            <View style={{ flex: 1 }}>
              <Button title="I can drive" size="sm" onPress={open} />
            </View>
          ) : canText ? (
            <View style={{ flex: 1 }}>
              <Button title={`Text ${ev.ride_driver}`} size="sm" onPress={textDriver} />
            </View>
          ) : state === 'driving_open' || state === 'driving_full' ? (
            <View style={{ flex: 1 }}>
              <Button title="Manage my car" size="sm" onPress={open} />
            </View>
          ) : state === 'quiet' ? (
            <View style={{ flex: 1 }}>
              <Button title="I can drive" size="sm" onPress={open} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title={
                unansweredMine > 0
                  ? `RSVP ${unansweredMine === 1 ? kids.find((k) => !ev.my_rsvps?.[k.id])?.first_name ?? '' : `${unansweredMine} kids`}`
                  : state === 'waiting'
                    ? 'See who is going'
                    : ev.open_slots > 0
                      ? `Snacks: ${ev.open_slots} open`
                      : 'Details'
              }
              kind={state === 'waiting' ? 'primary' : 'secondary'}
              size="sm"
              onPress={open}
            />
          </View>
        </Row>
      ) : null}
    </Card>
  );
}
