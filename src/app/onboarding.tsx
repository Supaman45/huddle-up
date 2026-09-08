import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { Button, Card, Chip, Input, Row, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, teamColors, useTheme } from '@/lib/theme';
import { useSession } from '@/providers/session';

interface Kid {
  first_name: string;
  last_initial: string;
  birth_year: string;
  color: string;
}

const thisYear = new Date().getFullYear();

export default function Onboarding() {
  const { profile, refresh } = useSession();
  const router = useRouter();
  const t = useTheme();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [householdName, setHouseholdName] = useState('');
  const [kids, setKids] = useState<Kid[]>([{ first_name: '', last_initial: '', birth_year: '', color: teamColors[0] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateKid(i: number, patch: Partial<Kid>) {
    setKids((k) => k.map((kid, idx) => (idx === i ? { ...kid, ...patch } : kid)));
  }

  async function finish() {
    const validKids = kids.filter((k) => k.first_name.trim());
    if (!name.trim()) return setError('Add your name so the team knows who is driving.');
    if (!validKids.length) return setError('Add at least one kid.');
    setBusy(true);
    setError(null);
    try {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile!.id);
      const hh = householdName.trim() || `${name.trim().split(' ').pop()} family`;
      const { data: hid, error: e1 } = await supabase.rpc('create_household', { p_name: hh });
      if (e1) throw e1;
      const rows = validKids.map((k) => ({
        household_id: hid,
        first_name: k.first_name.trim(),
        last_initial: k.last_initial.trim().slice(0, 1).toUpperCase(),
        birth_year: k.birth_year ? Number(k.birth_year) : null,
        color: k.color,
      }));
      const { error: e2 } = await supabase.from('athletes').insert(rows);
      if (e2) throw e2;
      await refresh();
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Spacer h={space.xl} />
        <Text variant="label" color="accent">
          Step 1 of 1
        </Text>
        <Text variant="h1" style={{ marginTop: space.xs }}>
          Your household
        </Text>
        <Text color="muted" style={{ marginTop: space.sm }}>
          Kids live inside your household. They never get accounts, and only adults you invite see them.
        </Text>
        <Spacer h={space.xl} />
        <Stack>
          <Input label="Your name" placeholder="Seri Strong" value={name} onChangeText={setName} autoComplete="name" />
          <Input label="Household name (optional)" placeholder="Strong family" value={householdName} onChangeText={setHouseholdName} />
        </Stack>
        <Spacer h={space.xl} />
        <Text variant="label" color="muted">
          Kids
        </Text>
        <Stack style={{ marginTop: space.sm }}>
          {kids.map((k, i) => (
            <Card key={i} rail={k.color} style={{ paddingLeft: space.xl }}>
              <Row gap={space.sm}>
                <View style={{ flex: 2 }}>
                  <Input placeholder="First name" value={k.first_name} onChangeText={(v) => updateKid(i, { first_name: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input placeholder="Last initial" maxLength={1} autoCapitalize="characters" value={k.last_initial} onChangeText={(v) => updateKid(i, { last_initial: v })} />
                </View>
                <View style={{ flex: 1.3 }}>
                  <Input placeholder={`${thisYear - 10}`} keyboardType="number-pad" maxLength={4} value={k.birth_year} onChangeText={(v) => updateKid(i, { birth_year: v })} />
                </View>
              </Row>
              <Row style={{ marginTop: space.md, flexWrap: 'wrap' }} gap={space.sm}>
                {teamColors.map((c) => (
                  <Pressable key={c} onPress={() => updateKid(i, { color: c })} accessibilityLabel={`Color ${c}`}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: c,
                        borderWidth: k.color === c ? 3 : 0,
                        borderColor: t.ink,
                      }}
                    />
                  </Pressable>
                ))}
              </Row>
              <Text variant="small" color="muted" style={{ marginTop: space.sm }}>
                Birth year helps match age groups. Optional.
              </Text>
            </Card>
          ))}
          <Row>
            <Chip
              label="+ Add another kid"
              tone="accent"
              onPress={() => setKids((k) => [...k, { first_name: '', last_initial: '', birth_year: '', color: teamColors[k.length % teamColors.length] }])}
            />
          </Row>
        </Stack>
        <Spacer h={space.xl} />
        {error ? (
          <Text variant="small" color="danger" style={{ marginBottom: space.md }}>
            {error}
          </Text>
        ) : null}
        <Button title="Set up my household" onPress={finish} loading={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
