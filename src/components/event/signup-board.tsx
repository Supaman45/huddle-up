import { View } from 'react-native';

import { SnackIcon } from '@/components/icons';
import { Button, Card, Chip, Input, Row, SectionHeader, Stack, Text } from '@/components/ui';
import { space, useTheme } from '@/lib/theme';
import type { Profile, SignupSlot } from '@/lib/types';

export interface SlotForm {
  open: boolean;
  title: string;
  kind: SignupSlot['kind'];
  needed: string;
}

interface Props {
  profile: Profile | null;
  slots: SignupSlot[];
  slotForm: SlotForm;
  setSlotForm: React.Dispatch<React.SetStateAction<SlotForm>>;
  addSlot: () => void;
  claim: (slot: SignupSlot) => void;
}

export function SignupBoard({ profile, slots, slotForm, setSlotForm, addSlot, claim }: Props) {
  const t = useTheme();
  return (
    <>
      {/* ---------- Signups ---------- */}
      <SectionHeader title="Snacks and volunteers" right={<Chip label="+ Add slot" tone="accent" onPress={() => setSlotForm((f) => ({ ...f, open: true }))} />} />
      {slotForm.open ? (
        <Card raised style={{ marginBottom: space.sm }}>
          <Stack>
            <Row>
              {(['snack', 'volunteer', 'equipment'] as SignupSlot['kind'][]).map((k) => (
                <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={slotForm.kind === k} onPress={() => setSlotForm((f) => ({ ...f, kind: k }))} />
              ))}
            </Row>
            <Input
              placeholder={slotForm.kind === 'snack' ? 'Orange slices and water' : slotForm.kind === 'volunteer' ? 'Line judge' : 'Bring the pop-up goals'}
              value={slotForm.title}
              onChangeText={(v) => setSlotForm((f) => ({ ...f, title: v }))}
            />
            <Input label="People needed" keyboardType="number-pad" value={slotForm.needed} onChangeText={(v) => setSlotForm((f) => ({ ...f, needed: v }))} />
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Add slot" onPress={addSlot} />
              </View>
              <Button title="Cancel" kind="ghost" onPress={() => setSlotForm((f) => ({ ...f, open: false }))} />
            </Row>
          </Stack>
        </Card>
      ) : null}
      <Stack gap={space.sm}>
        {slots.length === 0 && !slotForm.open ? (
          <Text variant="small" color="muted">
            No slots yet. Anyone on the team can add one. Only the person who signs up gets reminded.
          </Text>
        ) : null}
        {slots.map((s) => {
          const claims = s.claims ?? [];
          const mine = claims.some((c) => c.profile_id === profile?.id);
          const filled = claims.length >= s.needed;
          return (
            <Card key={s.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }} gap={10}>
                  <SnackIcon color={filled ? t.accent : t.gold} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold">{s.title}</Text>
                    <Text variant="small" color="muted">
                      {claims.length} of {s.needed} covered
                      {claims.length ? ` · ${claims.map((c) => c.profile?.full_name?.split(' ')[0]).join(', ')}` : ''}
                    </Text>
                  </View>
                </Row>
                <Chip
                  label={mine ? "I'm out" : filled ? 'Covered' : "I've got it"}
                  tone={mine ? 'neutral' : filled ? 'accent' : 'gold'}
                  onPress={mine || !filled ? () => claim(s) : undefined}
                />
              </Row>
            </Card>
          );
        })}
      </Stack>
    </>
  );
}
