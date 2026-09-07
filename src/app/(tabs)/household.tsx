import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Avatar, Button, Card, Chip, ListRow, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { useSession } from '@/providers/session';

interface Member {
  role: 'owner' | 'adult';
  label: string | null;
  profile: Profile;
}

const consentLabel = { household: 'Private to household', team: 'Team can see photos', shareable: 'Shareable' } as const;

export default function HouseholdScreen() {
  const { household, athletes, profile, refresh } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('household_members')
      .select('role, label, profile:profiles(*)')
      .eq('household_id', household.id);
    setMembers((data as unknown as Member[]) ?? []);
    await refresh();
  }, [household, refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function invite() {
    if (!household) return;
    const { data, error } = await supabase
      .from('household_invites')
      .insert({ household_id: household.id, created_by: profile!.id })
      .select('code')
      .single();
    if (error) return Alert.alert('Could not create invite', error.message);
    const msg = `Join our household on Huddle Up so you can see the kids' schedules and carpools. Open the app and enter household code ${data.code}. Link: huddleup://household/${data.code}`;
    try {
      await Share.share({ message: msg });
    } catch {
      await Clipboard.setStringAsync(msg);
      Alert.alert('Copied', 'Invite text copied to your clipboard.');
    }
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
          <Card key={a.id} accent={a.color}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="h3">
                  {a.first_name} {a.last_initial ? `${a.last_initial}.` : ''}
                </Text>
                <Text variant="small" color="muted">
                  {a.birth_year ? `Born ${a.birth_year}` : 'Birth year not set'}
                </Text>
              </View>
              <Chip label={consentLabel[a.media_consent]} tone={a.media_consent === 'household' ? 'accent' : 'gold'} onPress={() => cycleConsent(a.id, a.media_consent)} />
            </Row>
            <Text variant="small" color="muted" style={{ marginTop: space.sm }}>
              Tap the photo setting to change who can see pictures of {a.first_name}. Private to household is the default.
            </Text>
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
    </Screen>
  );
}
