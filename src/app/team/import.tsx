import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CalendarIcon, CheckIcon, XIcon } from '@/components/icons';
import { Button, Card, Chip, Divider, Input, Loading, NavBar, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { defaultMinutes, findDuplicate, parseSchedule, type ParsedRow } from '@/lib/schedule-parse';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import { supportsNamedZones, zonedTimeToUtc } from '@/lib/timezone';
import type { Team } from '@/lib/types';
import { useToast } from '@/providers/toast';

interface Proposed extends ParsedRow {
  startsAt: Date;
  include: boolean;
  duplicateOf: string | null;
}

const EXAMPLE = `Sat 9/13   9:00 AM   vs Red Robin      Fort Steilacoom #4
Sat 9/20   10:30 AM  at Puyallup Blue  Sparks Stadium
Wed 10/1   5:30 PM   Practice          Harry Todd Park`;

/**
 * Paste a season in.
 *
 * Most coaches do not have a calendar link. They have a league email or a PDF, and re-typing
 * thirty rows is where a team quietly gives up on an app. This reads the paste and proposes
 * events; nothing is written until the coach has seen every row it intends to create.
 *
 * Two rules hold this together. Anything the parser could not read is shown rather than
 * dropped, because losing a real game silently is far worse than showing a line to ignore.
 * And anything already on the schedule at that minute is marked and excluded by default, so
 * pasting the same email twice cannot double-book a season.
 */
export default function ImportSchedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [text, setText] = useState('');
  const [proposed, setProposed] = useState<Proposed[] | null>(null);
  const [skipped, setSkipped] = useState<{ line: number; raw: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').eq('id', id).single();
    setTeam(data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const zone = team?.timezone || 'America/Los_Angeles';
  const zonesWork = useMemo(() => supportsNamedZones(), []);

  async function review() {
    if (!team) return;
    if (!text.trim()) return toast('Paste the schedule first.', { tone: 'signal' });
    setBusy(true);

    const { rows, skipped: unread } = parseSchedule(text);

    // Compared against what is already on the schedule, over a window wide enough to cover
    // any paste: a duplicate the coach cannot see is one they will not catch.
    const { data: existing } = await supabase.from('events').select('id, starts_at, title').eq('team_id', id).eq('cancelled', false);

    const out: Proposed[] = rows.map((r) => {
      const startsAt = zonedTimeToUtc(r.year, r.month, r.day, r.hour, r.minute, zone);
      const dup = findDuplicate(startsAt, existing ?? []);
      return { ...r, startsAt, duplicateOf: dup?.id ?? null, include: !dup };
    });

    setProposed(out);
    setSkipped(unread);
    setBusy(false);
    setSaved(null);
  }

  async function create() {
    if (!team || !proposed) return;
    const chosen = proposed.filter((p) => p.include);
    if (!chosen.length) return toast('Nothing selected.', { tone: 'signal' });
    setBusy(true);

    const { error } = await supabase.from('events').insert(
      chosen.map((p) => ({
        team_id: id,
        title: p.title,
        type: p.type,
        starts_at: p.startsAt.toISOString(),
        ends_at: new Date(p.startsAt.getTime() + defaultMinutes(p.type) * 60000).toISOString(),
        location_name: p.location,
      })),
    );
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });

    setSaved(chosen.length);
    setProposed(null);
    setText('');
    toast(`${chosen.length} ${chosen.length === 1 ? 'event' : 'events'} added. Every family sees them now.`);
  }

  if (!team) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const includedCount = proposed?.filter((p) => p.include).length ?? 0;
  const dupCount = proposed?.filter((p) => p.duplicateOf).length ?? 0;
  const lowCount = proposed?.filter((p) => p.confidence === 'low' && p.include).length ?? 0;

  return (
    <Screen glow>
      <NavBar />
      <Text variant="label" color="accent">
        {team.name}
      </Text>
      <Text variant="display" style={{ marginTop: 4 }}>
        Paste the schedule
      </Text>
      <Text color="muted" style={{ marginTop: 6 }}>
        From the league email, a PDF or a spreadsheet. Copy the rows and drop them in. Nothing is added until you have seen exactly what it will create.
      </Text>

      {saved !== null ? (
        <Card style={{ marginTop: space.lg, borderColor: t.accent }}>
          <Row gap={10}>
            <CheckIcon color={t.accent} size={20} />
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              {saved} added to the schedule.
            </Text>
          </Row>
          <View style={{ marginTop: space.md }}>
            <Button title="Back to the team" kind="secondary" onPress={() => router.back()} />
          </View>
        </Card>
      ) : null}

      {proposed === null ? (
        <>
          <View style={{ marginTop: space.lg }}>
            <Input
              label="The schedule"
              value={text}
              onChangeText={setText}
              placeholder={EXAMPLE}
              multiline
              numberOfLines={10}
              style={{ minHeight: 180, textAlignVertical: 'top' }}
            />
          </View>
          <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
            One event per line, with a date and a start time on each. Dates without a year are read as the coming season.
          </Text>
          {!zonesWork ? (
            <Text variant="small" color="signal" style={{ marginTop: space.sm }}>
              This device cannot resolve named time zones, so times will be read in the phone&apos;s own zone. Check each one on the next screen before adding.
            </Text>
          ) : null}
          <View style={{ marginTop: space.lg }}>
            <Button title="Read it" icon={<CalendarIcon color={t.accentInk} size={20} />} onPress={review} loading={busy} />
          </View>
        </>
      ) : null}

      {/* ---------- Review ---------- */}
      {proposed !== null ? (
        <>
          <SectionHeader
            title={`${proposed.length} found`}
            right={<Chip label={`${includedCount} to add`} tone={includedCount ? 'accent' : undefined} />}
          />

          {dupCount ? (
            <Text variant="small" color="muted" style={{ marginBottom: space.md }}>
              {dupCount} {dupCount === 1 ? 'is' : 'are'} already on the schedule at that time and {dupCount === 1 ? 'is' : 'are'} switched off. Turn one on only if you meant to add a second event in the same slot.
            </Text>
          ) : null}
          {lowCount ? (
            <Text variant="small" color="signal" style={{ marginBottom: space.md }}>
              {lowCount} {lowCount === 1 ? 'row needs' : 'rows need'} a look. They are marked below.
            </Text>
          ) : null}

          <Stack gap={space.sm}>
            {proposed.map((p, i) => (
              <Card
                key={`${p.line}-${i}`}
                rail={p.duplicateOf ? t.faint : p.confidence === 'low' ? t.signal : t.accent}
                style={{ paddingLeft: space.xl, opacity: p.include ? 1 : 0.55 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="mono" color={p.duplicateOf ? 'faint' : 'accent'}>
                      {format(p.startsAt, 'EEE MMM d, yyyy').toUpperCase()} · {format(p.startsAt, 'h:mm a')}
                    </Text>
                    <Text variant="bodyBold" style={{ marginTop: 2 }}>
                      {p.title}
                    </Text>
                    <Text variant="small" color="muted">
                      {p.type}
                      {p.location ? ` · ${p.location}` : ' · no location'}
                    </Text>
                  </View>
                  <Chip
                    label={p.include ? 'Adding' : 'Skipped'}
                    tone={p.include ? 'accent' : undefined}
                    onPress={() => setProposed((rows) => rows!.map((r, j) => (j === i ? { ...r, include: !r.include } : r)))}
                  />
                </Row>

                {p.duplicateOf ? (
                  <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
                    Already on the schedule at this time.
                  </Text>
                ) : p.note ? (
                  <Text variant="small" color="signal" style={{ marginTop: space.sm }}>
                    {p.note}.
                  </Text>
                ) : null}

                <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
                  Line {p.line}: {p.raw}
                </Text>
              </Card>
            ))}
          </Stack>

          {skipped.length ? (
            <>
              <SectionHeader title="Not read" right={<Chip label={`${skipped.length}`} tone="signal" />} />
              <Card style={{ borderColor: t.signal }}>
                <Text variant="small" color="muted">
                  These lines had no date or no start time, so nothing was made from them. If one of these is a real game, add it by hand from the team page.
                </Text>
                <Divider />
                <Stack gap={space.sm} style={{ marginTop: space.md }}>
                  {skipped.map((s) => (
                    <Row key={s.line} gap={8} style={{ alignItems: 'flex-start' }}>
                      <XIcon color={t.faint} size={14} />
                      <View style={{ flex: 1 }}>
                        <Text variant="small">{s.raw}</Text>
                        <Text variant="small" color="faint">
                          Line {s.line} · {s.reason}
                        </Text>
                      </View>
                    </Row>
                  ))}
                </Stack>
              </Card>
            </>
          ) : null}

          <Row style={{ marginTop: space.xl }} gap={space.sm}>
            <View style={{ flex: 1 }}>
              <Button title={includedCount ? `Add ${includedCount} to the schedule` : 'Nothing selected'} onPress={create} loading={busy} disabled={!includedCount} />
            </View>
            <Button title="Start over" kind="ghost" onPress={() => setProposed(null)} />
          </Row>
          <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
            Times are read in {zone.replace('_', ' ')}, this team&apos;s zone, whatever zone you are in right now.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
