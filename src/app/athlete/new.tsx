import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Input, Row, Screen, Spacer, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, teamColors, useTheme } from '@/lib/theme';
import { useSession } from '@/providers/session';

export default function NewAthlete() {
  const router = useRouter();
  const t = useTheme();
  const { household, athletes, refresh } = useSession();
  const hid = household?.id ?? null;
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState(teamColors[athletes.length % teamColors.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!hid) return;
    if (!first.trim()) return setError('First name is required.');
    setBusy(true);
    const { error: e } = await supabase.from('athletes').insert({
      household_id: hid,
      first_name: first.trim(),
      last_initial: last.trim().slice(0, 1).toUpperCase(),
      birth_year: year ? Number(year) : null,
      color,
    });
    setBusy(false);
    if (e) return setError(e.message);
    await refresh();
    router.back();
  }

  return (
    <Screen>
      <Spacer h={space.lg} />
      <Text variant="h1">Add a kid</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        First name and last initial only. Teams see nothing else.
      </Text>
      <Spacer h={space.xl} />
      <Stack>
        <Input label="First name" value={first} onChangeText={setFirst} />
        <Input label="Last initial" value={last} onChangeText={setLast} maxLength={1} autoCapitalize="characters" />
        <Input label="Birth year (optional)" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
        <View style={{ gap: 6 }}>
          <Text variant="label" color="muted">
            Color
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {teamColors.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Color ${c}`}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: t.ink }} />
              </Pressable>
            ))}
          </Row>
        </View>
        {error ? (
          <Text variant="small" color="danger">
            {error}
          </Text>
        ) : null}
        <Button title="Add" onPress={save} loading={busy} />
        <Button title="Cancel" kind="ghost" onPress={() => router.back()} />
      </Stack>
    </Screen>
  );
}
