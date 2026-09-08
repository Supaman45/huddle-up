import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Share, View } from 'react-native';

import { AwayDates } from '@/components/away-dates';
import { Avatar, Button, Card, Chip, ListRow, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

interface Member {
  role: 'owner' | 'adult';
  label: string | null;
  profile: Profile;
}

const consentLabel = { household: 'Private to household', team: 'Team can see photos', shareable: 'Shareable' } as const;

// The calendar feed authenticates on the token in the URL, because no calendar app can send
// a header. The token is therefore the secret: it lands in browser history, in any proxy log
// and in our own edge logs, which is why rotating has to be one tap and honestly labelled.
const FEED_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calendar-feed`;
const feedUrl = (token: string, scheme: 'https' | 'webcal' = 'https') =>
  `${FEED_BASE.replace(/^https/, scheme)}?t=${token}`;

export default function HouseholdScreen() {
  const { household, athletes, profile, refresh } = useSession();
  // Read once, with optional chaining. The React Compiler hoists property reads out of
  // callbacks as memo dependencies, so `profile!.id` inside a handler is evaluated during
  // render, and on a deep link that happens before the session has resolved: null.id, crash.
  const uid = profile?.id ?? null;
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [icsToken, setIcsToken] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('household_members').select('role, label, profile:profiles(*)').eq('household_id', household.id);
    setMembers((data as unknown as Member[]) ?? []);
    const { data: hh } = await supabase.from('households').select('ics_token').eq('id', household.id).maybeSingle();
    setIcsToken((hh as { ics_token: string } | null)?.ics_token ?? null);
    await refresh();
  }, [household, refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function invite() {
    if (!household || !uid) return;
    const { data, error } = await supabase.from('household_invites').insert({ household_id: household.id, created_by: uid }).select('code').single();
    if (error) return Alert.alert('Could not create invite', error.message);
    const msg = `Join our household on Huddle Up so you can see the kids' schedules and carpools. Open the app and enter household code ${data.code}. Link: huddleup://household/${data.code}`;
    try {
      await Share.share({ message: msg });
    } catch {
      await Clipboard.setStringAsync(msg);
      Alert.alert('Copied', 'Invite text copied to your clipboard.');
    }
  }

  function confirmRotate() {
    const others = members.filter((m) => m.profile.id !== profile?.id).length;
    Alert.alert(
      'Replace the calendar link?',
      others > 0
        ? `The old link stops working straight away. You and the other ${others === 1 ? 'adult' : `${others} adults`} in your household all have to add the new one, or your calendars quietly stop updating.`
        : 'The old link stops working straight away, and you will need to add the new one to your calendar.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Replace it',
          style: 'destructive',
          onPress: async () => {
            if (!household) return;
            setRotating(true);
            const { data, error } = await supabase.rpc('rotate_ics_token', { p_household_id: household.id });
            setRotating(false);
            if (error) return toast(error.message, { tone: 'error' });
            setIcsToken(data);
            await Clipboard.setStringAsync(feedUrl(data));
            toast('New link copied. The old one is dead. Send this to the other adults.');
          },
        },
      ],
    );
  }

  async function cycleConsent(id: string, current: 'household' | 'team' | 'shareable') {
    const next = current === 'household' ? 'team' : current === 'team' ? 'shareable' : 'household';
    await supabase.from('athletes').update({ media_consent: next }).eq('id', id);
    await refresh();
  }

  return (
    <Screen>
      <Text variant="h1">{household?.name ?? 'Household'}</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        Kids are records here, never accounts. Every adult below sees the same schedule.
      </Text>

      <SectionHeader title="Kids" right={<Chip label="+ Add" tone="accent" onPress={() => router.push('/athlete/new')} />} />
      <Stack gap={space.sm}>
        {athletes.map((a) => (
          <Card key={a.id} rail={a.color} style={{ paddingLeft: space.xl }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: a.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flex: 1 })}>
                <Text variant="h3">
                  {a.first_name} {a.last_initial ? `${a.last_initial}.` : ''}
                </Text>
                <Text variant="small" color="accent">
                  {a.birth_year ? `Born ${a.birth_year} · ` : ''}See player card ›
                </Text>
              </Pressable>
              <Chip label={consentLabel[a.media_consent]} tone={a.media_consent === 'household' ? 'accent' : 'gold'} onPress={() => cycleConsent(a.id, a.media_consent)} />
            </Row>
            <Text variant="small" color="muted" style={{ marginTop: space.sm }}>
              Tap the photo setting to change who can see pictures of {a.first_name}. Private to household is the default.
            </Text>
            {uid ? (
              <View style={{ marginTop: space.md }}>
                <AwayDates athlete={a} createdBy={uid} />
              </View>
            ) : null}
          </Card>
        ))}
      </Stack>

      <SectionHeader title="Adults" right={<Chip label="+ Invite" tone="accent" onPress={invite} />} />
      <Stack gap={0}>
        {members.map((m) => (
          <ListRow
            key={m.profile.id}
            leading={<Avatar name={m.profile.full_name || m.profile.email || '?'} />}
            title={m.profile.full_name || m.profile.email || 'Adult'}
            subtitle={m.label ?? (m.role === 'owner' ? 'Owner' : 'Adult')}
          />
        ))}
      </Stack>
      <Text variant="small" color="muted" style={{ marginTop: space.md }}>
        Invite the other parent, a grandparent or a regular carpool driver. Up to six adults per household on the free plan.
      </Text>
      <View style={{ marginTop: space.xl }}>
        <Button title="Invite an adult" kind="secondary" onPress={invite} />
      </View>

      <SectionHeader title="Phone calendar" />
      <Card style={{ gap: space.sm }}>
        <Text variant="h3">Put every kid on your own calendar</Text>
        <Text variant="small" color="muted">
          Subscribe once and every practice, game and schedule change for every kid lands in Apple or Google Calendar automatically, with a two-hour heads-up alarm. Nobody has to
          re-enter anything.
        </Text>
        <Row gap={space.sm} style={{ marginTop: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Add to my calendar"
              onPress={() => {
                if (!icsToken) return;
                Linking.openURL(feedUrl(icsToken, 'webcal')).catch(() => toast('Copy the link instead and add it in your calendar app.', { tone: 'signal' }));
              }}
            />
          </View>
          <Button
            title="Copy link"
            kind="secondary"
            onPress={async () => {
              if (!icsToken) return;
              await Clipboard.setStringAsync(feedUrl(icsToken));
              toast('Calendar link copied');
            }}
          />
        </Row>
        <Text variant="small" color="faint">
          The link is the password. Anyone holding it can see where your kids are and when, with no sign-in, so send it only to your own people. If it ever gets out, replace it below.
        </Text>
        <Button title="Replace this link" kind="ghost" size="sm" onPress={confirmRotate} loading={rotating} />
      </Card>
      <View style={{ height: 20 }} />
    </Screen>
  );
}
