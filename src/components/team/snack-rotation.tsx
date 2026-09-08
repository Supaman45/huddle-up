import { addDays } from 'date-fns';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { SnackIcon } from '@/components/icons';
import { Button, Card, Chip, Input, Row, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { SlotKind } from '@/lib/types';
import { useToast } from '@/providers/toast';

const KINDS: { key: SlotKind; label: string; placeholder: string }[] = [
  { key: 'snack', label: 'Snacks', placeholder: 'Snacks and water' },
  { key: 'volunteer', label: 'Volunteer', placeholder: 'Line judge' },
  { key: 'equipment', label: 'Equipment', placeholder: 'Bring the pop-up goals' },
];

/**
 * An empty signup sheet is not a fair system. It is a race, and the same two or three
 * parents lose it every week while everyone else waits to see if they have to. This
 * assigns the whole season at once, evenly, and anyone can still swap or drop.
 */
export function SnackRotation({ teamId, onDone }: { teamId: string; onDone: () => Promise<void> }) {
  const t = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SlotKind>('snack');
  const [title, setTitle] = useState('Snacks and water');
  const [weeks, setWeeks] = useState('12');
  const [busy, setBusy] = useState(false);

  async function run() {
    const w = Math.min(52, Math.max(1, Number(weeks) || 12));
    setBusy(true);
    const { data, error } = await supabase.rpc('rotate_signups', {
      p_team_id: teamId,
      p_kind: kind,
      p_title: title.trim() || 'Snacks and water',
      p_from: new Date().toISOString(),
      p_to: addDays(new Date(), w * 7).toISOString(),
    });
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    const made = data ?? 0;
    setOpen(false);
    if (made === 0) {
      Alert.alert('Nothing to assign', 'Every event in that window already has a slot of this kind. Adding events first, then running this again, tops up the rotation without disturbing what is already assigned.');
      return;
    }
    toast(`${made} ${made === 1 ? 'date' : 'dates'} assigned, evenly across the team.`);
    await onDone();
  }

  if (!open) {
    return <Button title="Set up a fair rotation" kind="secondary" icon={<SnackIcon color={t.ink} size={18} />} onPress={() => setOpen(true)} />;
  }

  return (
    <Card raised>
      <Stack>
        <Text variant="h3">Share it out evenly</Text>
        <Text variant="small" color="muted">
          Every adult on the team gets a turn before anyone gets a second one. Turns already taken this season count, so running this later tops up rather than starting over. Any family can still swap.
        </Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {KINDS.map((k) => (
            <Chip
              key={k.key}
              label={k.label}
              selected={kind === k.key}
              onPress={() => {
                setKind(k.key);
                setTitle(k.placeholder);
              }}
            />
          ))}
        </Row>
        <Input label="What each turn is" value={title} onChangeText={setTitle} placeholder={KINDS.find((k) => k.key === kind)?.placeholder} />
        <Input label="How many weeks ahead" keyboardType="number-pad" value={weeks} onChangeText={setWeeks} />
        <Row>
          <View style={{ flex: 1 }}>
            <Button title="Assign the rotation" onPress={run} loading={busy} />
          </View>
          <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} />
        </Row>
      </Stack>
    </Card>
  );
}
