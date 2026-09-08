import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { Button, Card, Chip, Input, Row, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Athlete } from '@/lib/types';
import { useToast } from '@/providers/toast';

interface Away {
  id: string;
  athlete_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
}

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function label(a: Away): string {
  const from = parseISO(a.starts_on);
  const to = parseISO(a.ends_on);
  const sameMonth = from.getMonth() === to.getMonth();
  const range =
    a.starts_on === a.ends_on
      ? format(from, 'MMM d')
      : sameMonth
        ? `${format(from, 'MMM d')} to ${format(to, 'd')}`
        : `${format(from, 'MMM d')} to ${format(to, 'MMM d')}`;
  return a.reason ? `${range} · ${a.reason}` : range;
}

/**
 * Away dates for one kid. A family knows in August that October half-term is gone; making
 * them answer thirteen RSVPs in October is the app failing. One range, answered once, and
 * every event in it stops counting as unanswered for the coach.
 */
export function AwayDates({ athlete, createdBy }: { athlete: Athlete; createdBy: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Away[]>([]);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [to, setTo] = useState(() => startOfDay(addDays(new Date(), 6)));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('athlete_away')
      .select('id, athlete_id, starts_on, ends_on, reason')
      .eq('athlete_id', athlete.id)
      .order('starts_on');
    setRows(data ?? []);
  }, [athlete.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (isBefore(to, from)) return toast('The last day comes after the first day.', { tone: 'error' });
    setBusy(true);
    const { error } = await supabase.from('athlete_away').insert({
      athlete_id: athlete.id,
      starts_on: toDateOnly(from),
      ends_on: toDateOnly(to),
      reason: reason.trim() || null,
      created_by: createdBy,
    });
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    setOpen(false);
    setReason('');
    toast(`${athlete.first_name} is marked away. Coaches stop counting those days.`);
    await load();
  }

  async function remove(id: string) {
    await supabase.from('athlete_away').delete().eq('id', id);
    toast('Away dates removed', { tone: 'signal' });
    await load();
  }

  const upcoming = rows.filter((r) => !isBefore(parseISO(r.ends_on), startOfDay(new Date())));

  return (
    <Stack gap={space.sm}>
      <Row style={{ flexWrap: 'wrap' }}>
        {upcoming.map((a) => (
          <Chip key={a.id} label={`${label(a)}  ✕`} tone="signal" onPress={() => remove(a.id)} />
        ))}
        {!open ? <Chip label="+ Away dates" onPress={() => setOpen(true)} /> : null}
      </Row>

      {open ? (
        <Card raised>
          <Stack>
            <Text variant="h3">{athlete.first_name} is away</Text>
            <Text variant="small" color="muted">
              Every practice and game in this range stops asking you to RSVP, and your coach sees the gap now rather than on the day.
            </Text>
            <DateTimeField label="First day away" value={from} onChange={setFrom} dateOnly />
            <DateTimeField label="Last day away" value={to} onChange={setTo} dateOnly />
            <Input label="Why (optional)" placeholder="Family trip" value={reason} onChangeText={setReason} />
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Mark away" onPress={add} loading={busy} />
              </View>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} />
            </Row>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
