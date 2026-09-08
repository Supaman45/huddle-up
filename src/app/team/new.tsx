import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, Input, Row, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, teamColors, useTheme } from '@/lib/theme';
import type { Sport } from '@/lib/types';
import { useSession } from '@/providers/session';

export default function NewTeam() {
  const router = useRouter();
  const t = useTheme();
  const { athletes } = useSession();
  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('soccer');
  const [season, setSeason] = useState(`Fall ${new Date().getFullYear()}`);
  const [color, setColor] = useState(teamColors[0]);
  const [ics, setIcs] = useState('');
  const [kidIds, setKidIds] = useState<string[]>(athletes.length === 1 ? [athletes[0].id] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('Give the team a name the parents will recognize.');
    if (ics && !/^https?:\/\/|^webcal:\/\//i.test(ics.trim())) return setError('The schedule link should start with https:// or webcal://');
    setBusy(true);
    setError(null);
    const { data: tid, error: e1 } = await supabase.rpc('create_team', {
      p_name: name.trim(),
      p_sport: sport,
      p_season: season.trim(),
      p_color: color,
      p_ics_url: ics.trim().replace(/^webcal:\/\//i, 'https://') || null,
    });
    if (e1) {
      setBusy(false);
      return setError(e1.message);
    }
    if (kidIds.length) {
      await supabase.from('team_athletes').insert(kidIds.map((athlete_id) => ({ team_id: tid, athlete_id })));
    }
    if (ics.trim()) {
      // kick off the first sync; failures are surfaced on the team page
      supabase.functions.invoke('ics-sync', { body: { team_id: tid } }).catch(() => {});
    }
    setBusy(false);
    router.replace({ pathname: '/team/[id]', params: { id: tid as string } });
  }

  return (
    <Screen>
      <Spacer h={space.lg} />
      <Text variant="h1">New Team Space</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        Free, always. You become the manager. Share the code and parents join in one tap.
      </Text>
      <Spacer h={space.xl} />
      <Stack>
        <Input label="Team name" placeholder="Lakewood Strikers U10" value={name} onChangeText={setName} />
        <View style={{ gap: 6 }}>
          <Text variant="label" color="muted">
            Sport
          </Text>
          <Row>
            {(['soccer', 'basketball', 'other'] as Sport[]).map((s) => (
              <Chip key={s} label={s === 'other' ? 'Other' : s[0].toUpperCase() + s.slice(1)} selected={sport === s} onPress={() => setSport(s)} />
            ))}
          </Row>
        </View>
        <Input label="Season" value={season} onChangeText={setSeason} />
        <View style={{ gap: 6 }}>
          <Text variant="label" color="muted">
            Team color
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {teamColors.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Color ${c}`}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: t.ink }} />
              </Pressable>
            ))}
          </Row>
        </View>
        <Input
          label="Schedule link (optional)"
          placeholder="Paste the calendar link from TeamSnap, SportsEngine or GameChanger"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={ics}
          onChangeText={setIcs}
        />
        <Text variant="small" color="muted">
          In TeamSnap: Schedule, then Subscribe. In SportsEngine: Calendar, then Subscribe. In GameChanger: Schedule, then Sync to calendar. Paste the link here and the schedule
          stays in sync every hour. Nothing else changes for the coach.
        </Text>
        {athletes.length ? (
          <View style={{ gap: 6 }}>
            <Text variant="label" color="muted">
              Which of your kids is on this team?
            </Text>
            <Row style={{ flexWrap: 'wrap' }}>
              {athletes.map((a) => (
                <Chip
                  key={a.id}
                  label={a.first_name}
                  selected={kidIds.includes(a.id)}
                  onPress={() => setKidIds((ids) => (ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                />
              ))}
            </Row>
          </View>
        ) : null}
        {error ? (
          <Text variant="small" color="danger">
            {error}
          </Text>
        ) : null}
        <Button title="Create Team Space" onPress={create} loading={busy} />
        <Button title="Cancel" kind="ghost" onPress={() => router.back()} />
      </Stack>
    </Screen>
  );
}
