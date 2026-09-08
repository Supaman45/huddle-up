import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CarIcon } from '@/components/icons';
import { Avatar, Button, Card, Chip, Row, Text } from '@/components/ui';
import { rangeLabel, timeLabel } from '@/lib/dates';
import { space, useTheme } from '@/lib/theme';
import type { Athlete, MyEvent } from '@/lib/types';

const typeLabel: Record<string, string> = { game: 'Game', practice: 'Practice', tournament: 'Tournament', other: 'Event' };

// hero: the next-up card gets the raised treatment and the sage rail.
export function EventCard({ ev, athletes, hero = false, onChanged }: { ev: MyEvent; athletes: Athlete[]; hero?: boolean; onChanged?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const kids = athletes.filter((a) => ev.athlete_ids.includes(a.id));
  const needsRide = ev.my_ride_status === 'needs_ride';
  const othersNeedRide = !ev.my_ride_status && ev.open_requests > 0;
  const rail = ev.cancelled ? t.faint : needsRide || othersNeedRide ? t.signal : ev.my_ride_status === 'driving' ? t.accent : kids[0]?.color ?? ev.team_color;
  const open = () => router.push({ pathname: '/event/[id]', params: { id: ev.event_id } });
  const arriveAt = new Date(start.getTime() - 30 * 60000);
  const unansweredMine = kids.filter((k) => !ev.my_rsvps?.[k.id]).length;

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
          ) : needsRide ? (
            <Chip label="Needs ride" tone="signal" />
          ) : othersNeedRide ? (
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
            <CarIcon color={ev.my_ride_status ? t.accent : t.faint} size={20} />
            <Text variant="small" style={{ flex: 1 }}>
              {ev.my_ride_status === 'driving'
                ? "You're driving"
                : ev.my_ride_status === 'matched'
                  ? 'Ride set'
                  : ev.my_ride_status === 'needs_ride'
                    ? 'Waiting on a driver'
                    : ev.offers > 0
                      ? `${ev.offers} ${ev.offers === 1 ? 'car' : 'cars'} going`
                      : 'No carpools yet'}
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

      </Pressable>
        {hero && !ev.cancelled ? (
          <Row gap={8} style={{ marginTop: 2 }}>
            <View style={{ flex: 1 }}>
              <Button title={ev.my_ride_status === 'driving' ? 'Manage my car' : 'I can drive'} size="sm" onPress={open} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={unansweredMine > 0 ? `RSVP ${unansweredMine === 1 ? kids.find((k) => !ev.my_rsvps?.[k.id])?.first_name ?? '' : `${unansweredMine} kids`}` : ev.open_slots > 0 ? `Snacks: ${ev.open_slots} open` : 'Details'}
                kind="secondary"
                size="sm"
                onPress={open}
              />
            </View>
          </Row>
        ) : null}
    </Card>
  );
}
