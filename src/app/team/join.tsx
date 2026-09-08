import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Input, Row, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, sportLabel } from '@/lib/theme';
import type { Sport } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

interface Peek {
  id: string;
  name: string;
  sport: Sport;
  season: string;
  color: string;
}

export default function JoinTeam({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const { athletes } = useSession();
  const toast = useToast();
  const [code, setCode] = useState(initialCode ?? '');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [kidIds, setKidIds] = useState<string[]>(athletes.length === 1 ? [athletes[0].id] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setError(null);
    setBusy(true);
    const { data, error: e } = await supabase.rpc('peek_team', { p_code: code });
    setBusy(false);
    const row = (data as Peek[] | null)?.[0];
    if (e || !row) return setError('No team with that code. Codes are six letters and numbers.');
    setPeek(row);
  }

  async function join() {
    if (!peek) return;
    setBusy(true);
    const { data: tid, error: e } = await supabase.rpc('join_team', { p_code: code });
    if (e) {
      setBusy(false);
      return setError(e.message);
    }
    if (kidIds.length) {
      await supabase.from('team_athletes').upsert(
        kidIds.map((athlete_id) => ({ team_id: tid, athlete_id })),
        { onConflict: 'team_id,athlete_id' },
      );
    }
    setBusy(false);
    toast(`You're on ${peek.name}`);
    router.replace({ pathname: '/team/[id]', params: { id: tid as string } });
  }

  return (
    <Screen>
      <Spacer h={space.lg} />
      <Text variant="h1">Join a team</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        Enter the six-character code from the coach or team parent.
      </Text>
      <Spacer h={space.xl} />
      <Stack>
        <Input
          label="Team code"
          placeholder="A1B2C3"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setPeek(null);
          }}
          onSubmitEditing={lookup}
          style={{ fontSize: 28, letterSpacing: 6, textAlign: 'center' }}
        />
        {!peek ? <Button title="Find team" onPress={lookup} loading={busy} disabled={code.length < 6} /> : null}
        {error ? (
          <Text variant="small" color="danger">
            {error}
          </Text>
        ) : null}
        {peek ? (
          <Card raised rail={peek.color} style={{ paddingLeft: space.xl }}>
            <Row>
              <Avatar name={peek.name} color={peek.color} size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{peek.name}</Text>
                <Text variant="small" color="muted">
                  {sportLabel[peek.sport]}
                  {peek.season ? ` · ${peek.season}` : ''}
                </Text>
              </View>
            </Row>
            {athletes.length ? (
              <View style={{ marginTop: space.lg, gap: 6 }}>
                <Text variant="label" color="muted">
                  Who plays on this team?
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
            <View style={{ marginTop: space.lg }}>
              <Button title="Join team" onPress={join} loading={busy} />
            </View>
          </Card>
        ) : null}
        <Button title="Cancel" kind="ghost" onPress={() => router.back()} />
      </Stack>
    </Screen>
  );
}
