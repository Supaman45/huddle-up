import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { ChatIcon, MailIcon, PhoneIcon } from '@/components/icons';
import { Avatar, Button, Chip, Row, Text } from '@/components/ui';
import { contactLinks, driverMessage, kidName, seatsLeft } from '@/lib/carpool-dash';
import { radius, space, useTheme } from '@/lib/theme';
import type { CarpoolCar } from '@/lib/types';

const dirLabel: Record<CarpoolCar['direction'], string> = { to: 'There', from: 'Back', both: 'Both ways' };

/**
 * One car, and the adult behind the wheel.
 *
 * The rider list answers "which kids are with which grown-up". The contact card, a tap away,
 * answers the question a parent has at 8:40 on a Saturday when the car has not shown up. Call,
 * text and email are real buttons with a message already typed, because nobody wants to
 * compose one while looking for their keys.
 *
 * Phone and email are only visible to people who share a team with the driver; the database
 * enforces that, this component just shows what it was given.
 */
export function DriverCard({
  car,
  eventTitle,
  onManage,
  onRelease,
}: {
  car: CarpoolCar;
  eventTitle: string;
  /** Present on my own car: opens the event to change seats, note or cancel. */
  onManage?: () => void;
  /** Present on my own car: move a rider back to needing a ride. */
  onRelease?: (requestId: string, firstName: string) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const left = seatsLeft(car);
  const myKids = car.riders.filter((r) => r.mine);
  const hasMine = myKids.length > 0;

  const msg = driverMessage(car.driver_name, eventTitle, myKids.map(kidName));
  const links = contactLinks(car.driver_phone, car.driver_email, msg, Platform.OS);
  const reach = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: hasMine ? t.accent : t.line,
        backgroundColor: car.mine ? t.surfaceAlt : t.surface,
        padding: space.md,
        gap: space.sm,
      }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        disabled={car.mine}
        accessibilityRole="button"
        accessibilityLabel={car.mine ? 'Your car' : `${car.driver_name}, ${open ? 'hide' : 'show'} contact details`}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
          <Avatar name={car.driver_name} size={40} ring={car.mine ? t.accent : undefined} />
          <View style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyBold">{car.mine ? 'You' : car.driver_name}</Text>
              {left > 0 ? (
                <Chip label={`${left} ${left === 1 ? 'seat' : 'seats'} open`} tone="accent" />
              ) : (
                <Chip label="Full" />
              )}
            </Row>
            <Text variant="small" color="muted">
              {dirLabel[car.direction]} · {car.taken} of {car.seats} {car.seats === 1 ? 'seat' : 'seats'} taken
            </Text>
            {car.pickup_note ? (
              <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                {car.pickup_note}
              </Text>
            ) : null}
          </View>
        </Row>
      </Pressable>

      {/* Who is in this car. A parent's own kid gets the green ring; everyone else is a name. */}
      {car.riders.length ? (
        <View style={{ gap: 6, marginLeft: 40 + space.md }}>
          {car.riders.map((r) => (
            <Row key={r.request_id} style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <Avatar name={r.first_name} color={r.color} uri={r.photo_url} size={24} ring={r.mine ? t.accent : undefined} />
                <Text variant="small" color={r.mine ? 'accent' : undefined}>
                  {kidName(r)}
                  {r.mine ? '  · yours' : ''}
                </Text>
              </Row>
              {onRelease ? <Chip label="Let go" onPress={() => onRelease(r.request_id, r.first_name)} /> : null}
            </Row>
          ))}
        </View>
      ) : (
        <Text variant="small" color="faint" style={{ marginLeft: 40 + space.md }}>
          Nobody riding yet
        </Text>
      )}

      {car.mine && onManage ? (
        <Button title="Manage my car" kind="secondary" size="sm" onPress={onManage} />
      ) : null}

      {/* ---------- Contact card ---------- */}
      {open && !car.mine ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: space.sm, gap: space.sm }}>
          <Text variant="small" color="muted">
            {car.driver_phone ?? 'No phone on file'}
            {car.driver_email ? `  ·  ${car.driver_email}` : ''}
          </Text>
          <Row gap={space.sm}>
            <View style={{ flex: 1 }}>
              <Button title="Call" size="sm" kind={links.tel ? 'primary' : 'secondary'} disabled={!links.tel} icon={<PhoneIcon color={t.accentInk} size={16} />} onPress={() => reach(links.tel)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Text" size="sm" kind="secondary" disabled={!links.sms} icon={<ChatIcon color={t.ink} size={16} />} onPress={() => reach(links.sms)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Email" size="sm" kind="secondary" disabled={!links.mailto} icon={<MailIcon color={t.ink} size={16} />} onPress={() => reach(links.mailto)} />
            </View>
          </Row>
        </View>
      ) : null}
    </View>
  );
}
