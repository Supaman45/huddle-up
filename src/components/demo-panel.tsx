import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, Row, SectionHeader, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { Sport } from '@/lib/types';
import { useToast } from '@/providers/toast';

type DemoSport = Exclude<Sport, 'other'>;

interface LoadResult {
  team: string;
  kids: number;
  parents: number;
  events: number;
  my_kid_added: boolean;
  error?: string;
}

/**
 * Loads a walkthrough team: a full roster with numbers and pictures, six weeks of games and
 * practices starting this coming weekend, two parents who drive every Saturday, one who drives
 * once, kids waiting on rides, RSVPs, snack slots and a team chat that reads like a real one.
 *
 * Rendered only when is_app_admin() says so, and the edge function checks the same table
 * again on the server, so hiding the panel is a courtesy rather than the gate. Loading again
 * replaces the previous demo; nothing outside the demo team and its invented parents is ever
 * touched.
 */
export function DemoPanel() {
  const t = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [sport, setSport] = useState<DemoSport>('soccer');
  const [busy, setBusy] = useState<'load' | 'reset' | null>(null);
  const [last, setLast] = useState<LoadResult | null>(null);

  useEffect(() => {
    // A failed check means not an admin; there is nothing to show in that case either way.
    supabase.rpc('is_app_admin').then(({ data, error }) => setAdmin(!error && !!data));
  }, []);

  if (!admin) return null;

  async function run(action: 'load' | 'reset') {
    setBusy(action);
    const { data, error } = await supabase.functions.invoke<LoadResult>('demo', { body: action === 'load' ? { action, sport } : { action } });
    setBusy(null);
    if (error || data?.error) return Alert.alert('Demo did not load', error?.message ?? data?.error ?? 'Unknown error');
    if (action === 'reset') {
      setLast(null);
      toast('Demo data removed', { tone: 'signal' });
      return;
    }
    setLast(data);
    toast(`${data?.team} is ready. ${data?.kids} players, ${data?.events} events.`);
    router.replace('/(tabs)');
  }

  return (
    <>
      <SectionHeader title="Demo" right={<Chip label="Only you see this" />} />
      <Card style={{ borderColor: t.gold }}>
        <Text variant="bodyMedium">Load a walkthrough team</Text>
        <Text variant="small" color="muted" style={{ marginTop: 4 }}>
          A full roster with numbers and pictures, six weeks of games and practices from this weekend on, two weekly drivers, one one-off driver, kids waiting on rides, RSVPs, snacks and a live-looking chat. You join as manager and your first kid joins the roster.
        </Text>
        <Row style={{ marginTop: space.md }}>
          <Chip label="Soccer" selected={sport === 'soccer'} onPress={() => setSport('soccer')} />
          <Chip label="Basketball" selected={sport === 'basketball'} onPress={() => setSport('basketball')} />
        </Row>
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Button title={`Load ${sport === 'soccer' ? 'soccer' : 'basketball'} demo`} onPress={() => run('load')} loading={busy === 'load'} disabled={busy !== null} />
          <Button title="Remove demo data" kind="ghost" onPress={() => run('reset')} loading={busy === 'reset'} disabled={busy !== null} />
        </View>
        {last ? (
          <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
            Loaded {last.team}: {last.kids} players, {last.parents} adults, {last.events} events{last.my_kid_added ? ', your kid is on the roster' : ''}.
          </Text>
        ) : null}
        <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
          Loading again replaces the last demo. Demo parents have @demo.huddleup.test addresses and 555 numbers.
        </Text>
      </Card>
    </>
  );
}
