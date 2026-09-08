import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, HomeIcon } from '@/components/icons';
import { Avatar, BackLink, Button, Card, Chip, Input, Loading, Row, Stack, Text } from '@/components/ui';
import { timeLabel } from '@/lib/dates';
import { maxPeriods, periodLabel, STATS, statDef } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { fonts, radius, space, useTheme } from '@/lib/theme';
import type { Athlete, Event, Game, StatEvent, Team } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

export default function Scorekeeper() {
  const { id } = useLocalSearchParams<{ id: string }>(); // event id
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const toast = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [stats, setStats] = useState<StatEvent[]>([]);
  const [pickedAthlete, setPickedAthlete] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
    if (!ev) return;
    setEvent(ev as Event);
    const [{ data: tm }, { data: ta }, { data: g }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', ev.team_id).single(),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', ev.team_id),
      supabase.from('games').select('*').eq('event_id', id).maybeSingle(),
    ]);
    setTeam(tm as Team);
    setRoster((ta ?? []).map((r) => r.athlete).sort((a, b) => a.first_name.localeCompare(b.first_name)));
    setGame((g as Game) ?? null);
    if (g) {
      const { data: se } = await supabase
        .from('stat_events')
        .select('*, athlete:athletes(*)')
        .eq('game_id', (g as Game).id)
        .order('created_at', { ascending: false });
      setStats((se as StatEvent[]) ?? []);
    }
    if (!opponent && (ev as Event).title) {
      const m = (ev as Event).title.match(/(?:vs\.?|@|at)\s+(.+)$/i);
      if (m) setOpponent(m[1].trim());
      if ((ev as Event).title.match(/^@|\bat\b/i)) setIsHome(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!game) return;
    const ch = supabase
      .channel(`game-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events', filter: `game_id=eq.${game.id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [game?.id, load, game]);

  const isKeeper = !!game && game.scorekeeper_id === profile?.id;
  const sport = team?.sport ?? 'other';
  const defs = STATS[sport] ?? STATS.other;

  const perAthlete = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of stats) {
      if (!s.athlete_id) continue;
      m[s.athlete_id] = m[s.athlete_id] ?? {};
      m[s.athlete_id][s.stat_type] = (m[s.athlete_id][s.stat_type] ?? 0) + 1;
    }
    return m;
  }, [stats]);

  async function begin() {
    setBusy(true);
    const { data, error } = await supabase.rpc('start_game', { p_event_id: id, p_opponent: opponent.trim(), p_is_home: isHome });
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    toast('You’re keeping score. Tap a player, then a stat.');
    await load();
    void data;
  }

  async function tap(statKey: string) {
    if (!pickedAthlete || !game) return;
    const def = statDef(sport, statKey);
    const { error } = await supabase.from('stat_events').insert({
      game_id: game.id,
      athlete_id: pickedAthlete,
      stat_type: statKey,
      points: def?.points ?? 0,
      period: game.period,
      recorded_by: profile!.id,
    });
    if (error) return toast(error.message, { tone: 'error' });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const who = roster.find((a) => a.id === pickedAthlete)?.first_name ?? '';
    toast(`${who} · ${def?.label ?? statKey}`);
    setPickedAthlete(null);
  }

  async function undo() {
    const last = stats[0];
    if (!last) return;
    const { error } = await supabase.from('stat_events').delete().eq('id', last.id);
    if (error) return toast(error.message, { tone: 'error' });
    toast(`Undid ${last.athlete?.first_name ?? ''} ${statDef(sport, last.stat_type)?.label ?? last.stat_type}`, { tone: 'signal' });
  }

  async function bumpThem(delta: number) {
    if (!game) return;
    const next = Math.max(0, game.their_score + delta);
    await supabase.from('games').update({ their_score: next }).eq('id', game.id);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  async function setPeriod(p: number) {
    if (!game) return;
    await supabase.from('games').update({ period: p }).eq('id', game.id);
  }

  async function finish() {
    if (!game) return;
    Alert.alert('Final score?', `${team?.name} ${game.our_score} · ${game.opponent_name} ${game.their_score}`, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Final',
        onPress: async () => {
          await supabase.from('games').update({ status: 'final', ended_at: new Date().toISOString() }).eq('id', game.id);
          toast('Game saved. Stats are on every player card.');
        },
      },
    ]);
  }

  if (!event || !team) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <Loading />
      </View>
    );
  }

  // ---------- Setup: no game yet ----------
  if (!game) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: 60 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <BackLink />
          <Pressable onPress={() => router.replace('/(tabs)')} accessibilityLabel="Home" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <HomeIcon color={t.ink} size={20} />
          </Pressable>
        </Row>
        <Text variant="label" color="accent">
          Scorekeeper
        </Text>
        <Text variant="display" style={{ marginTop: 4 }}>
          Keep score?
        </Text>
        <Text color="muted" style={{ marginTop: 6 }}>
          One parent taps, everyone watching gets the score live, and every tap lands on your kid’s player card. Free.
        </Text>
        <Stack style={{ marginTop: space.xl }}>
          <Input label="Opponent" placeholder="Red Robin" value={opponent} onChangeText={setOpponent} />
          <View style={{ gap: 6 }}>
            <Text variant="label" color="faint">
              Where
            </Text>
            <Row>
              <Chip label="Home" selected={isHome} onPress={() => setIsHome(true)} />
              <Chip label="Away" selected={!isHome} onPress={() => setIsHome(false)} />
            </Row>
          </View>
          <Button title="Start keeping score" onPress={begin} loading={busy} />
          <Text variant="small" color="faint">
            Only one person keeps score per game. If someone else already started, this joins their game instead.
          </Text>
        </Stack>
      </ScrollView>
    );
  }

  // ---------- Live ----------
  const periods = maxPeriods(sport);
  const picked = roster.find((a) => a.id === pickedAthlete);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Scoreboard */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
          backgroundColor: t.surface,
          borderBottomWidth: 1,
          borderColor: t.lineStrong,
        }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <BackLink label="Done" />
          <Row gap={6}>
            {game.status === 'live' ? (
              <Row gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.signal }} />
                <Text variant="label" color="signal">
                  Live
                </Text>
              </Row>
            ) : (
              <Chip label="Final" tone="accent" />
            )}
          </Row>
        </Row>

        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="faint" numberOfLines={1}>
              {team.name}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 62, color: t.inkStrong }}>{game.our_score}</Text>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <Text variant="mono" color="faint">
              {periodLabel(sport, game.period)}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text variant="label" color="faint" numberOfLines={1}>
              {game.opponent_name}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 62, color: t.muted }}>{game.their_score}</Text>
          </View>
        </Row>

        {isKeeper && game.status === 'live' ? (
          <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
            <Row gap={6}>
              {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                <Chip key={p} label={periodLabel(sport, p)} selected={game.period === p} onPress={() => setPeriod(p)} />
              ))}
            </Row>
            <Row gap={6}>
              <Chip label="Them −" onPress={() => bumpThem(-1)} />
              <Chip label="Them +" tone="signal" onPress={() => bumpThem(sport === 'basketball' ? 2 : 1)} />
            </Row>
          </Row>
        ) : null}
      </View>

      {!isKeeper ? (
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
          <Card>
            <Text variant="h3">Following live</Text>
            <Text variant="small" color="muted" style={{ marginTop: 4 }}>
              Someone on the team is keeping score. The score updates here as it happens.
            </Text>
          </Card>
          <RecentFeed stats={stats} sport={sport} />
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 200 }}>
            <Text variant="label" color="faint" style={{ marginBottom: space.sm }}>
              {picked ? `Tap a stat for ${picked.first_name}` : 'Tap who did it'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {roster.map((a) => {
                const on = a.id === pickedAthlete;
                const line = perAthlete[a.id];
                const total = line ? Object.entries(line).reduce((n, [k, v]) => n + (statDef(sport, k)?.points ?? 0) * v, 0) : 0;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      setPickedAthlete(on ? null : a.id);
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    }}
                    style={{
                      width: '31.5%',
                      aspectRatio: 1,
                      borderRadius: radius.lg,
                      backgroundColor: on ? a.color : t.surface,
                      borderWidth: 2,
                      borderColor: on ? a.color : t.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}>
                    <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: on ? '#0F1620' : t.ink }} numberOfLines={1}>
                      {a.first_name}
                    </Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: on ? '#0F1620' : t.faint }}>{total > 0 ? `${total} pts` : '—'}</Text>
                  </Pressable>
                );
              })}
              {roster.length === 0 ? <Text color="muted">No players on the roster yet. Add them on the team page and they show up here.</Text> : null}
            </View>

            <Text variant="label" color="faint" style={{ marginTop: space.xl, marginBottom: space.sm }}>
              Last plays
            </Text>
            <RecentFeed stats={stats} sport={sport} />
          </ScrollView>

          {/* Stat bar pinned to the thumb */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: space.md,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.md,
              backgroundColor: t.surfaceAlt,
              borderTopWidth: 1,
              borderColor: t.lineStrong,
              gap: space.sm,
            }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {defs.map((d) => (
                <Pressable
                  key={d.key}
                  disabled={!pickedAthlete}
                  onPress={() => tap(d.key)}
                  style={{
                    flexGrow: 1,
                    minWidth: 92,
                    paddingVertical: 16,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    backgroundColor: !pickedAthlete ? t.surface : d.scoring ? t.accent : t.surfaceRaised,
                    opacity: !pickedAthlete ? 0.45 : 1,
                    borderWidth: d.scoring ? 0 : 1,
                    borderColor: t.line,
                  }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: !pickedAthlete ? t.faint : d.scoring ? t.accentInk : t.ink }}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Undo last" kind="secondary" size="sm" disabled={!stats.length} onPress={undo} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={game.status === 'final' ? 'Saved' : 'End game'}
                  kind="ghost"
                  size="sm"
                  icon={<CheckIcon color={t.accent} size={16} />}
                  onPress={finish}
                  disabled={game.status === 'final'}
                />
              </View>
            </Row>
          </View>
        </>
      )}
    </View>
  );
}

function RecentFeed({ stats, sport }: { stats: StatEvent[]; sport: 'soccer' | 'basketball' | 'other' }) {
  const t = useTheme();
  if (!stats.length) {
    return (
      <Text variant="small" color="faint">
        Nothing yet.
      </Text>
    );
  }
  return (
    <Stack gap={0}>
      {stats.slice(0, 12).map((s) => (
        <Row key={s.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }}>
          <Avatar name={s.athlete?.first_name ?? '?'} color={s.athlete?.color} size={26} />
          <Text variant="bodyMedium" style={{ flex: 1 }}>
            {s.athlete?.first_name ?? 'Team'} <Text color="muted">{statDef(sport, s.stat_type)?.label ?? s.stat_type}</Text>
          </Text>
          <Text variant="mono" color="faint">
            {timeLabel(new Date(s.created_at))}
          </Text>
        </Row>
      ))}
    </Stack>
  );
}
