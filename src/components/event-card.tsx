import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Row, Text } from '@/components/ui';
import { rangeLabel } from '@/lib/dates';
import { radius, space, useTheme } from '@/lib/theme';
import type { Athlete, MyEvent } from '@/lib/types';

const typeLabel: Record<string, string> = { game: 'Game', practice: 'Practice', tournament: 'Tournament', other: 'Event' };

export function EventCard({ ev, athletes }: { ev: MyEvent; athletes: Athlete[] }) {
  const t = useTheme();
  const router = useRouter();
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const kids = athletes.filter((a) => ev.athlete_ids.includes(a.id));

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.event_id } })}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          borderLeftWidth: 5,
          borderLeftColor: ev.team_color,
          padding: space.lg,
          opacity: pressed ? 0.85 : ev.cancelled ? 0.55 : 1,
        },
      ]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label" color="muted">
          {rangeLabel(start, end)}
        </Text>
        <Chip label={ev.cancelled ? 'Cancelled' : typeLabel[ev.type]} tone={ev.type === 'game' ? 'accent' : 'neutral'} />
      </Row>
      <Text variant="h2" style={{ marginTop: 6, textDecorationLine: ev.cancelled ? 'line-through' : 'none' }}>
        {ev.title}
      </Text>
      <Text variant="small" color="muted" style={{ marginTop: 2 }}>
        {ev.team_name}
        {ev.location_name ? ` · ${ev.location_name}` : ''}
      </Text>
      <Row style={{ marginTop: space.md, flexWrap: 'wrap' }} gap={6}>
        {kids.map((k) => (
          <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.color }} />
            <Text variant="small">{k.first_name}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        {ev.my_ride_status === 'needs_ride' ? <Chip label="Needs a ride" tone="signal" /> : null}
        {ev.my_ride_status === 'driving' ? <Chip label="You're driving" tone="accent" /> : null}
        {ev.my_ride_status === 'matched' ? <Chip label="Ride set" tone="accent" /> : null}
        {!ev.my_ride_status && ev.open_requests > 0 ? <Chip label={`${ev.open_requests} need rides`} tone="signal" /> : null}
        {ev.open_slots > 0 ? <Chip label={`${ev.open_slots} open ${ev.open_slots === 1 ? 'slot' : 'slots'}`} tone="gold" /> : null}
      </Row>
    </Pressable>
  );
}
