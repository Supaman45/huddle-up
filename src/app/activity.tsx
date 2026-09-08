import { formatDistanceToNowStrict, isToday, isYesterday, format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { BallIcon, CalendarIcon, CarIcon, SnackIcon, TrophyIcon, XIcon } from '@/components/icons';
import { Card, Chip, Empty, Loading, NavBar, Row, Screen, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useLive } from '@/providers/live';
import { space, useTheme } from '@/lib/theme';
import type { ActivityKind, ActivityRow } from '@/lib/types';

function iconFor(kind: ActivityKind, color: string, size = 18) {
  switch (kind) {
    case 'ride_needed':
    case 'ride_filled':
    case 'ride_leaving':
      return <CarIcon color={color} size={size} />;
    case 'slot_claimed':
      return <SnackIcon color={color} size={size} />;
    case 'game_final':
      return <TrophyIcon color={color} size={size} />;
    case 'event_cancelled':
      return <XIcon color={color} size={size} />;
    case 'event_added':
      return <CalendarIcon color={color} size={size} />;
    default:
      return <BallIcon color={color} size={size} />;
  }
}

// Orange is reserved for things a parent has to act on or absorb: a change, a cancellation,
// an open seat. Everything else is calm.
function toneFor(kind: ActivityKind): 'signal' | 'accent' | 'plain' {
  if (kind === 'event_changed' || kind === 'event_cancelled' || kind === 'ride_needed') return 'signal';
  if (kind === 'ride_filled' || kind === 'game_final' || kind === 'ride_leaving') return 'accent';
  return 'plain';
}

function bucket(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

export default function Activity() {
  const t = useTheme();
  const router = useRouter();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_activity', { p_limit: 80 });
    setRows(data ?? []);
    // Opening the screen is the read receipt. Marking after the fetch keeps the
    // "new" dots visible on this pass and clears them for the next one.
    await supabase.rpc('mark_activity_read');
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLive(load);

  const teams = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    for (const r of rows ?? []) m.set(r.team_id, { id: r.team_id, name: r.team_name, color: r.team_color });
    return [...m.values()];
  }, [rows]);

  const shown = (rows ?? []).filter((r) => !teamFilter || r.team_id === teamFilter);
  const groups: { label: string; items: ActivityRow[] }[] = [];
  for (const r of shown) {
    const label = bucket(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }

  return (
    <Screen
      glow
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={t.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      <NavBar />
      <Text variant="display">What changed</Text>
      <Text color="muted" style={{ marginTop: 6 }}>
        Every schedule change, ride and signup across your teams. Newest first.
      </Text>

      {teams.length > 1 ? (
        <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
          <Chip label="All teams" selected={!teamFilter} onPress={() => setTeamFilter(null)} />
          {teams.map((tm) => (
            <Chip key={tm.id} label={tm.name} dot={tm.color} selected={teamFilter === tm.id} onPress={() => setTeamFilter(teamFilter === tm.id ? null : tm.id)} />
          ))}
        </Row>
      ) : null}

      {rows === null ? <Loading /> : null}

      {rows !== null && shown.length === 0 ? (
        <View style={{ marginTop: space.xl }}>
          <Empty title="Nothing has changed" body="When a coach moves a practice, a parent asks for a ride or someone claims the snack slot, it lands here." />
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.label} style={{ marginTop: space.xl }}>
          <Text variant="label" color="faint" style={{ marginBottom: space.md }}>
            {g.label.toUpperCase()}
          </Text>
          <Stack gap={space.sm}>
            {g.items.map((r) => {
              const tone = toneFor(r.kind);
              const accentColor = tone === 'signal' ? t.signal : tone === 'accent' ? t.accent : r.team_color;
              const body = (
                <Card rail={r.is_new ? accentColor : undefined} style={{ paddingLeft: r.is_new ? space.xl : space.lg, opacity: r.kind === 'event_cancelled' ? 0.9 : 1 }}>
                  <Row style={{ alignItems: 'flex-start' }} gap={10}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tone === 'signal' ? t.signalSoft : tone === 'accent' ? t.accentSoft : t.surfaceAlt,
                      }}>
                      {iconFor(r.kind, accentColor)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text variant="bodyBold" style={{ flex: 1, textDecorationLine: r.kind === 'event_cancelled' ? 'line-through' : 'none' }}>
                          {r.title}
                        </Text>
                        <Text variant="small" color="faint">
                          {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: false })}
                        </Text>
                      </Row>
                      <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                        {r.body}
                      </Text>
                      <Text variant="label" color="faint" style={{ marginTop: 6 }}>
                        {r.team_name.toUpperCase()}
                        {r.actor_name ? ` · ${r.actor_name.toUpperCase()}` : ''}
                      </Text>
                    </View>
                  </Row>
                </Card>
              );
              return r.event_id ? (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: r.event_id! } })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                  {body}
                </Pressable>
              ) : (
                <View key={r.id}>{body}</View>
              );
            })}
          </Stack>
        </View>
      ))}

      <Text variant="small" color="faint" style={{ marginTop: space.xxl }}>
        Phone alerts arrive with the first real build on the App Store. Until then this screen is the record.
      </Text>
    </Screen>
  );
}
