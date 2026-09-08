import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, Card, Empty, Row, SectionHeader, Stack, Text } from '@/components/ui';
import { statDef } from '@/lib/stats';
import { fonts, space, useTheme } from '@/lib/theme';
import type { LeaderRow, Team, TeamRecord } from '@/lib/types';

/** A finished game plus the event it belongs to, from a joined select. */
export interface FinalGame {
  id: string;
  event_id: string;
  opponent_name: string;
  is_home: boolean;
  our_score: number;
  their_score: number;
  ended_at: string | null;
  event?: { starts_at: string; title: string } | null;
}

interface Props {
  team: Team;
  record: TeamRecord | null;
  results: FinalGame[];
  leaders: LeaderRow[];
}

export function SeasonTab({ team, record, results, leaders }: Props) {
  const t = useTheme();
  const router = useRouter();

  // One leader per stat: the kid with the most of it, ties broken by name.
  const topLeaders = Object.values(
    leaders.reduce<Record<string, LeaderRow>>((acc, l) => {
      const best = acc[l.stat_type];
      if (!best || l.tally > best.tally || (l.tally === best.tally && l.first_name < best.first_name)) acc[l.stat_type] = l;
      return acc;
    }, {}),
  )
    .filter((l) => l.tally > 0)
    .sort((a, b) => b.tally - a.tally);

  return (
    <View>
      <Card raised style={{ marginTop: space.md }}>
        <Text variant="label" color="faint">
          Record
        </Text>
        <Row style={{ marginTop: space.sm, justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 46, lineHeight: 46, color: t.inkStrong }}>
            {record?.wins ?? 0}-{record?.losses ?? 0}
            {record?.ties ? `-${record.ties}` : ''}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="mono" color="muted">
              {record?.points_for ?? 0} FOR · {record?.points_against ?? 0} AGAINST
            </Text>
            <Text variant="small" color="faint" style={{ marginTop: 4 }}>
              {record?.games_played ?? 0} {record?.games_played === 1 ? 'game scored' : 'games scored'}
            </Text>
          </View>
        </Row>
      </Card>

      {topLeaders.length ? (
        <>
          <SectionHeader title="Leaders" />
          <Stack gap={space.sm}>
            {topLeaders.map((l) => (
              <Card key={`${l.athlete_id}-${l.stat_type}`} rail={l.color} style={{ paddingLeft: space.xl }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={10} style={{ flex: 1 }}>
                    <Avatar name={l.first_name} color={l.color} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold">
                        {l.first_name} {l.last_initial ? `${l.last_initial}.` : ''}
                      </Text>
                      <Text variant="small" color="muted">
                        {statDef(team.sport, l.stat_type)?.label ?? l.stat_type}
                      </Text>
                    </View>
                  </Row>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 24, color: t.inkStrong }}>{l.tally}</Text>
                </Row>
              </Card>
            ))}
          </Stack>
        </>
      ) : null}

      <SectionHeader title="Results" />
      {results.length === 0 ? (
        <Empty title="No finals yet" body="Open a game and tap Keep score. Whoever is on the sideline can do it, and the result lands here and on every player card." />
      ) : null}
      <Stack gap={space.sm}>
        {results.map((g) => {
          const won = g.our_score > g.their_score;
          const tied = g.our_score === g.their_score;
          return (
            <Pressable key={g.id} onPress={() => router.push({ pathname: '/game/[id]', params: { id: g.event_id } })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <Card rail={tied ? t.faint : won ? t.accent : t.signal} style={{ paddingLeft: space.xl }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" color={tied ? 'faint' : won ? 'accent' : 'signal'}>
                      {tied ? 'Tie' : won ? 'Won' : 'Lost'}
                    </Text>
                    <Text variant="bodyBold" style={{ marginTop: 2 }}>
                      {g.is_home ? 'vs' : 'at'} {g.opponent_name}
                    </Text>
                    <Text variant="small" color="muted">
                      {g.event?.starts_at ? format(new Date(g.event.starts_at), 'EEE, MMM d') : ''}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 26, color: t.inkStrong }}>
                    {g.our_score}-{g.their_score}
                  </Text>
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </Stack>
    </View>
  );
}
