import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { PencilIcon, PinIcon } from '@/components/icons';
import { Button, Card, Input, Row, Stack, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { TeamPlace } from '@/lib/types';
import { useToast } from '@/providers/toast';

/**
 * Getting to the right field.
 *
 * A park address drops a parent at the entrance, and "Field 4" means nothing to someone who
 * has never been. The place is keyed on the location name the schedule already carries, so
 * a coach fills it in once and every future event at that field inherits it, including the
 * ones imported from TeamSnap next month.
 */
export function GettingThere({
  teamId,
  locationName,
  locationAddress,
  place,
  isStaff,
  createdBy,
  onSaved,
}: {
  teamId: string;
  locationName: string | null;
  locationAddress: string | null;
  place: TeamPlace | null;
  isStaff: boolean;
  createdBy: string;
  onSaved: () => Promise<void>;
}) {
  const t = useTheme();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [mapUrl, setMapUrl] = useState(place?.map_url ?? '');
  const [parking, setParking] = useState(place?.parking_note ?? '');
  const [bring, setBring] = useState(place?.bring_note ?? '');
  const [busy, setBusy] = useState(false);

  if (!locationName && !locationAddress) return null;

  function openMaps() {
    if (place?.map_url) return void Linking.openURL(place.map_url).catch(() => {});
    const q = encodeURIComponent(locationAddress || locationName || '');
    const url = Platform.select({ ios: `maps:0,0?q=${q}`, default: `https://www.google.com/maps/search/?api=1&query=${q}` });
    Linking.openURL(url!).catch(() => {});
  }

  async function save() {
    if (!locationName) return;
    setBusy(true);
    const row = {
      team_id: teamId,
      name: locationName,
      map_url: mapUrl.trim() || null,
      parking_note: parking.trim() || null,
      bring_note: bring.trim() || null,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    };
    const { error } = place
      ? await supabase.from('team_places').update(row).eq('id', place.id)
      : await supabase.from('team_places').insert(row);
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    setEditing(false);
    toast(`Saved. Every event at ${locationName} shows this now.`);
    await onSaved();
  }

  return (
    <Card style={{ marginTop: space.lg, gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Pressable onPress={openMaps} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
          <Row gap={10}>
            <PinIcon color={t.accent} size={20} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{locationName ?? locationAddress}</Text>
              <Text variant="small" color="accent">
                {place?.map_url ? 'Tap for the pin on the field' : 'Tap for directions'}
              </Text>
            </View>
          </Row>
        </Pressable>
        {isStaff && !editing ? (
          <Pressable onPress={() => setEditing(true)} accessibilityLabel="Edit this place" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <PencilIcon color={t.muted} size={18} />
          </Pressable>
        ) : null}
      </Row>

      {place?.parking_note && !editing ? (
        <Text variant="small" color="muted">
          Parking: {place.parking_note}
        </Text>
      ) : null}
      {place?.bring_note && !editing ? (
        <Text variant="small" color="muted">
          Bring: {place.bring_note}
        </Text>
      ) : null}

      {!place && isStaff && !editing ? (
        <Text variant="small" color="faint">
          Nobody has said where to park or which entrance to use. Tap the pencil once and every event here gets it.
        </Text>
      ) : null}

      {editing ? (
        <Stack style={{ marginTop: space.sm }}>
          <Text variant="small" color="muted">
            This is saved to {locationName}, not to this one event, so every game and practice here shows it.
          </Text>
          <Input
            label="Maps link for the exact field"
            placeholder="Paste from Apple or Google Maps"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={mapUrl}
            onChangeText={setMapUrl}
          />
          <Input label="Parking" placeholder="Lot off Angle Lane fills by 8:30, overflow is on Elwood" value={parking} onChangeText={setParking} />
          <Input label="What to bring" placeholder="Camp chairs, no shade on this side" value={bring} onChangeText={setBring} />
          <Row>
            <View style={{ flex: 1 }}>
              <Button title="Save for this field" onPress={save} loading={busy} />
            </View>
            <Button title="Cancel" kind="ghost" onPress={() => setEditing(false)} />
          </Row>
        </Stack>
      ) : null}
    </Card>
  );
}
