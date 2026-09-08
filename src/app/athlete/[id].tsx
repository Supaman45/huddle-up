import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';

import { BallIcon, HomeIcon } from '@/components/icons';
import { Avatar, BackLink, Card, Chip, Divider, Loading, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { STATS, statDef, summaryLine } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { fonts, radius, space, useTheme } from '@/lib/theme';
import type { CardRow, Sport } from '@/lib/types';
import { useToast } from '@/providers/toast';

interface SeasonBlock {
  key: string;
  team_id: string;
  team_name: string;
  sport: Sport;
  season: string;
  games: number;
  totals: Record<string, number>;
  is_current: boolean;
}

export default function PlayerCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('athlete_card', { p_athlete_id: id });
    if (error) toast(error.message, { tone: 'error' });
    setRows((data as CardRow[]) ?? []);
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const seasons = useMemo<SeasonBlock[]>(() => {
    const m: Record<string, SeasonBlock> = {};
    for (const r of rows ?? []) {
      if (!r.team_id || !r.stat_type) continue;
      const key = `${r.team_id}`;
      m[key] = m[key] ?? {
        key,
        team_id: r.team_id,
        team_name: r.team_name ?? 'Team',
        sport: (r.sport ?? 'other') as Sport,
        season: r.season ?? '',
        games: 0,
        totals: {},
        is_current: !!r.is_current,
      };
      m[key].totals[r.stat_type] = (m[key].totals[r.stat_type] ?? 0) + (r.tally ?? 0);
      m[key].games = Math.max(m[key].games, r.games ?? 0);
    }
    return Object.values(m).sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.team_name.localeCompare(b.team_name));
  }, [rows]);

  const kid = rows?.[0];
  const current = seasons.find((s) => s.is_current) ?? seasons[0];
  const past = seasons.filter((s) => s !== current);

  function flip() {
    const to = flipped ? 0 : 1;
    setFlipped(!flipped);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(spin, { toValue: to, useNativeDriver: true, damping: 14, stiffness: 120 }).start();
  }

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = spin.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = spin.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  if (!rows) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!kid) {
    return (
      <Screen>
        <BackLink />
        <Text variant="h2">Not found</Text>
        <Text color="muted">This player is not in your household or on a team you are on.</Text>
      </Screen>
    );
  }

  const careerTotals: Record<string, number> = {};
  for (const s of seasons) for (const [k, v] of Object.entries(s.totals)) careerTotals[k] = (careerTotals[k] ?? 0) + v;
  const careerGames = seasons.reduce((n, s) => n + s.games, 0);
  const cardSport = current?.sport ?? 'other';

  return (
    <Screen glow>
      <Row style={{ justifyContent: 'space-between' }}>
        <BackLink />
        <Pressable onPress={() => router.replace('/(tabs)')} accessibilityLabel="Home" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <HomeIcon color={t.ink} size={20} />
        </Pressable>
      </Row>

      {/* ---------- The card ---------- */}
      <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel="Flip card">
        <View style={{ height: 420, marginTop: space.sm }}>
          {/* Front */}
          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
              borderRadius: 22,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: kid.color,
              backgroundColor: t.surfaceAlt,
            }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
              <View style={{ position: 'absolute', top: -80, width: 380, height: 380, borderRadius: 190, backgroundColor: kid.color, opacity: 0.14 }} />
              <Avatar name={`${kid.first_name} ${kid.last_initial}`} color={kid.color} size={132} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 44, color: t.inkStrong }}>
                  {kid.first_name} {kid.last_initial ? `${kid.last_initial}.` : ''}
                </Text>
                <Text variant="mono" color="muted" style={{ marginTop: 4 }}>
                  {current ? `${current.team_name.toUpperCase()}` : 'NO TEAM YET'}
                  {kid.birth_year ? ` · ${kid.birth_year}` : ''}
                </Text>
              </View>
              {current ? (
                <Chip label={summaryLine(current.sport, current.totals)} tone="accent" />
              ) : (
                <Chip label="No games scored yet" />
              )}
            </View>
            <Row style={{ justifyContent: 'center', paddingBottom: space.md }}>
              <Text variant="small" color="faint">
                Tap to flip
              </Text>
            </Row>
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotate }],
              borderRadius: 22,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: kid.color,
              backgroundColor: t.surface,
              padding: space.lg,
            }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="h2">{current ? current.season || current.team_name : 'This season'}</Text>
              <Chip label={`${current?.games ?? 0} ${current?.games === 1 ? 'game' : 'games'}`} />
            </Row>
            <Divider />
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {(STATS[cardSport] ?? STATS.other).map((d) => (
                <Row key={d.key} style={{ justifyContent: 'space-between' }}>
                  <Text color="muted">{d.label}</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 20, color: t.inkStrong }}>{current?.totals[d.key] ?? 0}</Text>
                </Row>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Divider />
            <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
              <Text variant="label" color="faint">
                Career
              </Text>
              <Text variant="mono" color="accent">
                {summaryLine(cardSport, careerTotals)} · {careerGames} games
              </Text>
            </Row>
          </Animated.View>
        </View>
      </Pressable>

      {/* ---------- Season history ---------- */}
      <SectionHeader title="Seasons" right={<Chip label={`${seasons.length || 0}`} />} />
      {seasons.length === 0 ? (
        <Card>
          <Text variant="bodyMedium">No stats yet</Text>
          <Text variant="small" color="muted" style={{ marginTop: 4 }}>
            Stats appear here the first time a parent keeps score for one of {kid.first_name}'s games. Open a game and tap Keep score.
          </Text>
        </Card>
      ) : null}
      <Stack gap={space.sm}>
        {[current, ...past].filter(Boolean).map((s) => (
          <Card key={s!.key} rail={s!.is_current ? t.accent : undefined} style={{ paddingLeft: s!.is_current ? space.xl : space.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={10} style={{ flex: 1 }}>
                <BallIcon color={s!.is_current ? t.accent : t.faint} size={18} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold">{s!.team_name}</Text>
                  <Text variant="small" color="muted">
                    {s!.season || 'Season'} · {s!.games} {s!.games === 1 ? 'game' : 'games'}
                  </Text>
                </View>
              </Row>
              {s!.is_current ? <Chip label="Now" tone="accent" /> : null}
            </Row>
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }} gap={space.md}>
              {Object.entries(s!.totals).map(([k, v]) => (
                <View key={k} style={{ alignItems: 'center', minWidth: 54 }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 22, color: t.inkStrong }}>{v}</Text>
                  <Text variant="label" color="faint">
                    {statDef(s!.sport, k)?.short ?? k}
                  </Text>
                </View>
              ))}
            </Row>
          </Card>
        ))}
      </Stack>

      {/* ---------- What Family Plus adds ---------- */}
      <SectionHeader title="Family Plus" />
      <Card style={{ borderColor: t.gold, gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h3">Keep the whole story</Text>
          <Chip label="Soon" tone="gold" />
        </Row>
        <Text variant="small" color="muted">
          The current season is free forever. Family Plus keeps every season {kid.first_name} ever plays, adds photos and clips to this card, and gives grandparents their own login. $59 a year for the whole household.
        </Text>
        <Text variant="small" color="faint">
          Not for sale yet. Nothing here is behind a paywall today.
        </Text>
      </Card>
    </Screen>
  );
}
