import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { CameraIcon } from '@/components/icons';
import { TeamCrest, clearCrestCache } from '@/components/team-crest';
import { Button, Card, Chip, Input, Row, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, teamColors, useTheme } from '@/lib/theme';
import type { Team } from '@/lib/types';
import { useToast } from '@/providers/toast';

export function TeamBrand({ team, onSaved }: { team: Team; onSaved: () => Promise<void> }) {
  const t = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(team.color);
  const [accent, setAccent] = useState<string | null>(team.accent_color);

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('Allow photo access to add a crest.', { tone: 'error' });
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled) return;
    setBusy(true);
    try {
      const path = `${team.id}/brand/logo-${Date.now()}.png`;
      const blob = await (await fetch(res.assets[0].uri)).blob();
      const { error: upErr } = await supabase.storage.from('team-media').upload(path, blob, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from('teams').update({ logo_path: path }).eq('id', team.id);
      if (error) throw error;
      if (team.logo_path)
        await supabase.storage
          .from('team-media')
          .remove([team.logo_path])
          .catch(() => {});
      clearCrestCache();
      toast('Crest set. It shows on the team header and invites.');
      await onSaved();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    if (!team.logo_path) return;
    setBusy(true);
    await supabase.from('teams').update({ logo_path: null }).eq('id', team.id);
    await supabase.storage.from('team-media').remove([team.logo_path]);
    clearCrestCache(team.logo_path);
    setBusy(false);
    toast('Crest removed', { tone: 'signal' });
    await onSaved();
  }

  async function saveColors() {
    setBusy(true);
    const { error } = await supabase.from('teams').update({ color, accent_color: accent }).eq('id', team.id);
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    toast('Colors saved');
    await onSaved();
  }

  const dirty = color !== team.color || accent !== team.accent_color;

  return (
    <Stack>
      <Card raised>
        <Row gap={space.lg}>
          <TeamCrest name={team.name} color={color} logoPath={team.logo_path} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="h3">{team.name}</Text>
            <Text variant="small" color="muted" style={{ marginTop: 2 }}>
              {team.logo_path ? 'Square works best. PNG with a clear background looks sharpest.' : 'Add the club crest, or leave it and keep the color monogram.'}
            </Text>
          </View>
        </Row>
        <Row style={{ marginTop: space.md }} gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Button
              title={team.logo_path ? 'Replace crest' : 'Add a crest'}
              kind="secondary"
              size="sm"
              icon={<CameraIcon color={t.ink} size={18} />}
              onPress={pickLogo}
              loading={busy}
            />
          </View>
          {team.logo_path ? <Button title="Remove" kind="ghost" size="sm" onPress={removeLogo} /> : null}
        </Row>
      </Card>

      <Text variant="label" color="faint">
        Team color
      </Text>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        {teamColors.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Team color ${c}`}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: c,
                borderWidth: color === c ? 3 : 1,
                borderColor: color === c ? t.inkStrong : t.line,
              }}
            />
          </Pressable>
        ))}
      </Row>
      <Text variant="small" color="muted">
        The team color rails every card and dot for this team, so families with two kids on two teams can tell them apart at a glance.
      </Text>

      <Text variant="label" color="faint">
        Highlight
      </Text>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        <Chip label="App default" selected={!accent} onPress={() => setAccent(null)} />
        {teamColors.slice(0, 5).map((c) => (
          <Chip key={c} label=" " dot={c} selected={accent === c} onPress={() => setAccent(c)} />
        ))}
      </Row>
      <Text variant="small" color="muted">
        Buttons and live markers inside this team use the highlight. Orange stays reserved for rides and changes no matter what you pick.
      </Text>

      {dirty ? <Button title="Save colors" onPress={saveColors} loading={busy} /> : null}
    </Stack>
  );
}

export function LinkedCalendar({ team, onSaved }: { team: Team; onSaved: () => Promise<void> }) {
  const [url, setUrl] = useState(team.ics_url ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const clean = url.trim().replace(/^webcal:\/\//i, 'https://') || null;
    const { error } = await supabase.from('teams').update({ ics_url: clean, ics_last_error: null }).eq('id', team.id);
    if (!error && clean) await supabase.functions.invoke('ics-sync', { body: { team_id: team.id } }).catch(() => {});
    setBusy(false);
    if (error) Alert.alert('Could not save', error.message);
    await onSaved();
  }
  return (
    <Stack>
      <Input placeholder="https://... .ics" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl} />
      <Text variant="small" color="muted">
        Paste the subscribe link from TeamSnap, SportsEngine or GameChanger. Events sync every hour and on demand. Manual events you add here are kept.
      </Text>
      <Button title="Save link and sync" kind="secondary" onPress={save} loading={busy} />
    </Stack>
  );
}
