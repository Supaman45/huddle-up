import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Share, View } from 'react-native';

import { TrophyIcon } from '@/components/icons';
import { useSignedUrl } from '@/components/team-crest';
import { Avatar, BackLink, Button, Card, Chip, Divider, Loading, Row, Screen, Text } from '@/components/ui';
import { STATS, summaryLine } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { fonts, space, useTheme } from '@/lib/theme';
import type { CardRow, Sport } from '@/lib/types';

interface Shot {
  id: string;
  storage_path: string;
  taken_at: string;
}

/**
 * The season recap: one card, sized and composed for a phone screenshot, because that is
 * how a parent actually sends something to grandma. No image export dependency, no share
 * sheet that produces a broken PNG. What goes out is either a screenshot of this, or the
 * plain-text version below it, and both are honest about what the season actually held.
 */
export default function SeasonRecap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: media }] = await Promise.all([
      supabase.rpc('athlete_card', { p_athlete_id: id }),
      supabase.rpc('athlete_media', { p_athlete_id: id, p_limit: 1 }),
    ]);
    setRows(data ?? []);
    setShot(((media as Shot[]) ?? [])[0] ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hero = useSignedUrl(shot?.storage_path);

  const season = useMemo(() => {
    const current = (rows ?? []).filter((r) => r.is_current && r.stat_type);
    const totals: Record<string, number> = {};
    for (const r of current) totals[r.stat_type!] = (totals[r.stat_type!] ?? 0) + (r.tally ?? 0);
    return {
      totals,
      games: Math.max(0, ...current.map((r) => r.games ?? 0)),
      team: current[0]?.team_name ?? rows?.[0]?.team_name ?? '',
      label: current[0]?.season ?? '',
      sport: (current[0]?.sport ?? 'other') as Sport,
    };
  }, [rows]);

  if (!rows) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const kid = rows[0];
  if (!kid) {
    return (
      <Screen>
        <BackLink />
        <Text variant="h2">Not found</Text>
      </Screen>
    );
  }

  const played = season.games > 0;
  const defs = (STATS[season.sport] ?? STATS.other).filter((d) => (season.totals[d.key] ?? 0) > 0);

  async function share() {
    const line = played
      ? `${kid.first_name}'s season with ${season.team}: ${season.games} games, ${summaryLine(season.sport, season.totals)}.`
      : `${kid.first_name} is playing with ${season.team} this season.`;
    await Share.share({ message: line }).catch(() => {});
  }

  return (
    <Screen glow>
      <BackLink />
      <Text variant="label" color="faint" style={{ marginTop: space.md }}>
        Season recap
      </Text>
      <Text color="muted" style={{ marginTop: 4, marginBottom: space.lg }}>
        Screenshot the card and send it. It is built to fit one.
      </Text>

      {/* ---------- The card ---------- */}
      <Card raised style={{ padding: 0, overflow: 'hidden', borderColor: kid.color }}>
        <View style={{ height: 200, backgroundColor: t.surfaceAlt }}>
          {hero ? (
            <Image source={{ uri: hero }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: kid.color, opacity: 0.14 }} />
              <Avatar name={`${kid.first_name} ${kid.last_initial}`} color={kid.color} size={96} />
            </View>
          )}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, backgroundColor: 'rgba(15,22,32,0.82)' }} />
          <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.md }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 40, color: t.inkStrong }}>
              {kid.first_name} {kid.last_initial ? `${kid.last_initial}.` : ''}
            </Text>
            <Text variant="mono" color="muted">
              {season.team.toUpperCase()}
              {season.label ? ` · ${season.label.toUpperCase()}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ padding: space.lg, gap: space.md }}>
          {played ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 52, lineHeight: 52, color: t.inkStrong }}>{season.games}</Text>
                  <Text variant="label" color="faint">
                    Games played
                  </Text>
                </View>
                <TrophyIcon color={kid.color} size={40} />
              </Row>
              <Divider />
              <Row style={{ flexWrap: 'wrap' }} gap={space.xl}>
                {defs.map((d) => (
                  <View key={d.key}>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 26, color: t.inkStrong }}>{season.totals[d.key] ?? 0}</Text>
                    <Text variant="label" color="faint">
                      {d.label}
                    </Text>
                  </View>
                ))}
                {defs.length === 0 ? (
                  <Text variant="small" color="muted">
                    Played every week. The stats start the first time someone keeps score.
                  </Text>
                ) : null}
              </Row>
            </>
          ) : (
            <>
              <Text variant="h3">A season played</Text>
              <Text variant="small" color="muted">
                No one kept score this season, so there are no numbers to show. Open a game and tap Keep score and next season this card fills itself in.
              </Text>
            </>
          )}
          <Text variant="label" color="faint" style={{ marginTop: space.sm }}>
            Huddle Up
          </Text>
        </View>
      </Card>

      <Row style={{ marginTop: space.lg }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Button title="Share as text" kind="secondary" onPress={share} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Back to card" kind="ghost" onPress={() => router.replace({ pathname: '/athlete/[id]', params: { id } })} />
        </View>
      </Row>

      <Card style={{ marginTop: space.xl, borderColor: t.gold, gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h3">Every season, not just this one</Text>
          <Chip label="Soon" tone="gold" />
        </Row>
        <Text variant="small" color="muted">
          Family Plus keeps every recap {kid.first_name} ever earns, side by side, and adds the photos. $59 a year for the whole household. Nothing here is behind a paywall today.
        </Text>
      </Card>
    </Screen>
  );
}
