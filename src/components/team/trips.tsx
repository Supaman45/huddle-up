import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { Button, Card, Input, Row, SectionHeader, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { Trip } from '@/lib/types';
import { useToast } from '@/providers/toast';

/**
 * Tournaments and away weekends, as one thing each. Only shown once a team actually has
 * one, or to staff who can create one, so a rec team that never travels never sees it.
 */
export function Trips({ teamId, isStaff, createdBy }: { teamId: string; isStaff: boolean; createdBy: string }) {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [from, setFrom] = useState(() => startOfDay(addDays(new Date(), 14)));
  const [to, setTo] = useState(() => startOfDay(addDays(new Date(), 16)));
  const [base, setBase] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('trips').select('*').eq('team_id', teamId).order('starts_on');
    setTrips(data ?? []);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return toast('Name the trip, like "Puyallup Fall Classic".', { tone: 'error' });
    if (isBefore(to, from)) return toast('The last day comes after the first day.', { tone: 'error' });
    setBusy(true);
    const { error } = await supabase.from('trips').insert({
      team_id: teamId,
      name: name.trim(),
      starts_on: format(from, 'yyyy-MM-dd'),
      ends_on: format(to, 'yyyy-MM-dd'),
      base_name: base.trim() || null,
      base_url: baseUrl.trim() || null,
      notes: notes.trim() || null,
      created_by: createdBy,
    });
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    setOpen(false);
    setName('');
    setBase('');
    setBaseUrl('');
    setNotes('');
    toast('Trip added. Every game in those dates joins it automatically.');
    await load();
  }

  const upcoming = trips.filter((tr) => !isBefore(parseISO(tr.ends_on), startOfDay(new Date())));
  if (!upcoming.length && !isStaff) return null;

  return (
    <>
      <SectionHeader title="Trips and tournaments" />
      <Stack gap={space.sm}>
        {upcoming.map((tr) => {
          const f = parseISO(tr.starts_on);
          const l = parseISO(tr.ends_on);
          const nights = Math.max(0, Math.round((l.getTime() - f.getTime()) / 86_400_000));
          return (
            <Pressable key={tr.id} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: tr.id } })}>
              <Card rail={t.gold} style={{ paddingLeft: space.xl }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold">{tr.name}</Text>
                    <Text variant="small" color="muted">
                      {format(f, 'EEE MMM d')} to {format(l, 'EEE MMM d')} · {nights === 0 ? 'day trip' : `${nights} ${nights === 1 ? 'night' : 'nights'}`}
                    </Text>
                  </View>
                  <Text variant="small" color="accent">
                    Open ›
                  </Text>
                </Row>
              </Card>
            </Pressable>
          );
        })}
        {upcoming.length === 0 && isStaff ? (
          <Text variant="small" color="muted">
            A tournament is one weekend to a family and eleven calendar entries to an app. Add one and it becomes a single thing again.
          </Text>
        ) : null}
      </Stack>

      {isStaff && !open ? (
        <View style={{ marginTop: space.md }}>
          <Button title="Add a trip" kind="secondary" onPress={() => setOpen(true)} />
        </View>
      ) : null}

      {open ? (
        <Card raised style={{ marginTop: space.md }}>
          <Stack>
            <Text variant="h3">New trip</Text>
            <Input label="Name" placeholder="Puyallup Fall Classic" value={name} onChangeText={setName} />
            <DateTimeField label="First day" value={from} onChange={setFrom} dateOnly />
            <DateTimeField label="Last day" value={to} onChange={setTo} dateOnly />
            <Input label="Where the team is staying" placeholder="Hampton Inn Puyallup" value={base} onChangeText={setBase} />
            <Input label="Booking link" placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={baseUrl} onChangeText={setBaseUrl} />
            <Input label="Anything families need to know" placeholder="Team dinner Saturday 6pm, bring both kits" value={notes} onChangeText={setNotes} />
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Add trip" onPress={create} loading={busy} />
              </View>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} />
            </Row>
          </Stack>
        </Card>
      ) : null}
    </>
  );
}
