import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';

import { Button, Card, Divider, Input, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import { useSession } from '@/providers/session';

interface Prefs {
  reminders: boolean;
  schedule_changes: boolean;
  carpool: boolean;
  signups: boolean;
}

export default function Me() {
  const { profile, refresh, signOut } = useSession();
  const t = useTheme();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [prefs, setPrefs] = useState<Prefs>({ reminders: true, schedule_changes: true, carpool: true, signups: true });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', profile!.id);
    await supabase.from('notification_prefs').upsert({ profile_id: profile!.id, athlete_id: null, event_type: null, ...prefs }, { onConflict: 'profile_id,athlete_id,event_type' });
    setSaving(false);
    if (error) Alert.alert('Could not save', error.message);
    else await refresh();
  }

  function toggle(k: keyof Prefs) {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
  }

  return (
    <Screen>
      <Text variant="h1">Settings</Text>
      <Text color="muted" style={{ marginTop: 4 }}>
        {profile?.email}
      </Text>

      <SectionHeader title="Your profile" />
      <Stack>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Mobile (for carpool texts)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="253 555 0100" />
      </Stack>

      <SectionHeader title="Notifications" />
      <Card style={{ padding: 0 }}>
        {(
          [
            ['reminders', 'Event reminders', 'The night before and an hour before'],
            ['schedule_changes', 'Schedule changes', 'Field, time or cancellation'],
            ['carpool', 'Carpool updates', 'Only for rides involving your kids'],
            ['signups', 'Snack and volunteer', 'Only slots you signed up for, plus open-slot nudges'],
          ] as [keyof Prefs, string, string][]
        ).map(([k, title, sub], i) => (
          <View key={k}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{title}</Text>
                <Text variant="small" color="muted">
                  {sub}
                </Text>
              </View>
              <Switch value={prefs[k]} onValueChange={() => toggle(k)} trackColor={{ true: t.accent }} />
            </Row>
          </View>
        ))}
      </Card>
      <Text variant="small" color="muted" style={{ marginTop: space.sm }}>
        Nothing goes to the whole team unless the whole team needs it. Per-kid and per-team controls arrive with Release 1.
      </Text>

      <View style={{ marginTop: space.xl }}>
        <Button title="Save" onPress={save} loading={saving} />
      </View>

      <SectionHeader title="Support" />
      <Card>
        <Text variant="bodyMedium">A person answers within one business day.</Text>
        <Text variant="small" color="muted" style={{ marginTop: 4 }}>
          No chatbots. Email support@huddleup.app or tap below.
        </Text>
        <View style={{ marginTop: space.md }}>
          <Button title="Email support" kind="secondary" onPress={() => Linking.openURL('mailto:support@huddleup.app?subject=Huddle%20Up%20help')} />
        </View>
      </Card>

      <SectionHeader title="Promise" />
      <Text variant="small" color="muted">
        Free for teams, forever. No ads on any screen a kid or coach sees. We never sell data. Delete your household and every record goes with it.
      </Text>

      <View style={{ marginTop: space.xxl }}>
        <Button title="Sign out" kind="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
