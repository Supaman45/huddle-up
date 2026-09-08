import { formatDistanceToNowStrict } from 'date-fns';
import { Linking, Pressable, Switch, View } from 'react-native';

import { CarIcon } from '@/components/icons';
import { Avatar, Button, Card, Chip, Divider, Input, Row, SectionHeader, Stack, Text } from '@/components/ui';
import { space, useTheme } from '@/lib/theme';
import type { Athlete, CarpoolOffer, CarpoolRequest, Profile, RideDirection } from '@/lib/types';

const dirLabel: Record<RideDirection, string> = { to: 'There', from: 'Back', both: 'Both ways' };

export interface OfferForm {
  open: boolean;
  seats: string;
  direction: RideDirection;
  note: string;
  /** Repeat this car for every event like this one, every week. */
  repeat: boolean;
}

interface Props {
  profile: Profile | null;
  myKidsOnTeam: Athlete[];
  offers: CarpoolOffer[];
  requests: CarpoolRequest[];
  openRequests: CarpoolRequest[];
  othersWaiting: CarpoolRequest[];
  iAmWaiting: boolean;
  myOffer: CarpoolOffer | undefined;
  seatsOpen: number;
  seatsTaken: (offerId: string) => number;
  offerForm: OfferForm;
  setOfferForm: React.Dispatch<React.SetStateAction<OfferForm>>;
  requestRide: (athleteId: string) => void;
  cancelRequest: (requestId: string) => void;
  offerRide: () => void;
  cancelOffer: (offerId: string) => void;
  takeRider: (request: CarpoolRequest, offer: CarpoolOffer) => void;
  releaseRider: (request: CarpoolRequest) => void;
  announceDeparture: (offer: CarpoolOffer, minutes: number) => void;
  /** Lowercase day name for this event, e.g. "Tuesday". */
  weekdayName: string;
  /** "practice" or "game", for the repeat copy. */
  eventTypeWord: string;
}

export function CarpoolBoard({
  profile,
  myKidsOnTeam,
  offers,
  requests,
  openRequests,
  othersWaiting,
  iAmWaiting,
  myOffer,
  seatsOpen,
  seatsTaken,
  offerForm,
  setOfferForm,
  requestRide,
  cancelRequest,
  offerRide,
  cancelOffer,
  takeRider,
  releaseRider,
  announceDeparture,
  weekdayName,
  eventTypeWord,
}: Props) {
  const t = useTheme();
  return (
    <>
      {/* ---------- Carpool ----------
        Two parents, opposite jobs. Whoever is looking, the thing they have to do next
        is the first thing on screen: your own kids' ride status, then the kids still
        waiting, then the cars. Orange means unresolved. Green means settled. */}
      <SectionHeader
        title="Carpool"
        right={
          openRequests.length ? (
            <Chip label={`${openRequests.length} need${openRequests.length === 1 ? 's' : ''} a ride`} tone="signal" />
          ) : offers.length ? (
            <Chip label={`${seatsOpen} ${seatsOpen === 1 ? 'seat' : 'seats'} open`} tone="accent" />
          ) : (
            <Chip label="No cars yet" />
          )
        }
      />

      {/* 1. Your kids. One row each, and the row IS the action. */}
      {myKidsOnTeam.length ? (
        <Stack gap={space.sm}>
          {myKidsOnTeam.map((k) => {
            const req = requests.find((r) => r.athlete_id === k.id && r.status !== 'cancelled');
            const driver = req?.offer_id ? offers.find((o) => o.id === req.offer_id) : null;
            const matched = req?.status === 'matched';
            const waiting = req?.status === 'open';
            return (
              <Card key={k.id} rail={matched ? t.accent : waiting ? t.signal : k.color} style={{ paddingLeft: space.xl }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={10} style={{ flex: 1 }}>
                    <Avatar name={k.first_name} color={k.color} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold">{k.first_name}</Text>
                      <Text variant="small" color={waiting ? 'signal' : matched ? 'accent' : 'muted'}>
                        {matched
                          ? `Riding with ${driver?.driver?.full_name?.split(' ')[0] ?? 'a parent'}`
                          : waiting
                            ? `Waiting on a driver${req?.created_at ? ` · asked ${formatDistanceToNowStrict(new Date(req.created_at))} ago` : ''}`
                            : 'No ride needed'}
                      </Text>
                    </View>
                  </Row>
                  {matched ? (
                    <Chip label="Cancel" onPress={() => cancelRequest(req!.id)} />
                  ) : waiting ? (
                    <Chip label="Cancel" tone="signal" onPress={() => cancelRequest(req!.id)} />
                  ) : (
                    <Chip label="Need a ride" tone="accent" onPress={() => requestRide(k.id)} />
                  )}
                </Row>
                {matched && driver?.pickup_note ? (
                  <Text variant="small" color="muted" style={{ marginTop: space.sm, marginLeft: 44 }}>
                    {driver.pickup_note}
                  </Text>
                ) : null}
                {matched && driver?.driver?.phone ? (
                  <View style={{ marginTop: space.md, marginLeft: 44 }}>
                    <Button title={`Text ${driver.driver.full_name.split(' ')[0]}`} kind="secondary" size="sm" onPress={() => Linking.openURL(`sms:${driver.driver!.phone}`)} />
                  </View>
                ) : null}
                {waiting ? (
                  <Text variant="small" color="faint" style={{ marginTop: space.sm, marginLeft: 44 }}>
                    {seatsOpen > 0 ? `${seatsOpen} open ${seatsOpen === 1 ? 'seat' : 'seats'} on this team right now.` : 'No open seats yet. Every driver on the team sees this.'}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </Stack>
      ) : null}

      {/* 2. Other families still waiting. This is the driver's target, so it sits above the cars. */}
      {othersWaiting.length ? (
        <Card style={{ marginTop: space.md, borderColor: t.signal, backgroundColor: t.signalSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" color="signal">
              Still needs a ride
            </Text>
            <Text variant="small" color="signal">
              {othersWaiting.length}
            </Text>
          </Row>
          <Stack gap={space.sm} style={{ marginTop: space.md }}>
            {othersWaiting.map((r) => (
              <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                <Row gap={8} style={{ flex: 1 }}>
                  <Avatar name={r.athlete?.first_name ?? '?'} color={r.athlete?.color} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">
                      {r.athlete?.first_name} {r.athlete?.last_initial ? `${r.athlete.last_initial}.` : ''}
                    </Text>
                    <Text variant="small" color="muted">
                      {r.requester?.full_name?.split(' ')[0] ?? 'A parent'}
                      {r.created_at ? ` · ${formatDistanceToNowStrict(new Date(r.created_at))} ago` : ''}
                    </Text>
                  </View>
                </Row>
                {myOffer && seatsTaken(myOffer.id) < myOffer.seats ? <Button title="Take" size="sm" onPress={() => takeRider(r, myOffer)} /> : null}
              </Row>
            ))}
          </Stack>
          {!myOffer && !offerForm.open ? (
            <View style={{ marginTop: space.md }}>
              <Button title="I can drive" icon={<CarIcon color={t.accentInk} size={20} />} onPress={() => setOfferForm((f) => ({ ...f, open: true }))} />
            </View>
          ) : null}
          {myOffer && seatsTaken(myOffer.id) >= myOffer.seats ? (
            <Text variant="small" color="muted" style={{ marginTop: space.md }}>
              Your car is full. Add a seat below if you have room.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* 3. Offering a car, when you are not the one waiting on one. */}
      {iAmWaiting ? (
        <Text variant="small" color="muted" style={{ marginTop: space.md }}>
          Cancel your ride request above if you end up driving after all.
        </Text>
      ) : !myOffer && !offerForm.open && !othersWaiting.length ? (
        <View style={{ marginTop: space.md }}>
          <Button title="I can drive" kind="secondary" icon={<CarIcon color={t.ink} size={20} />} onPress={() => setOfferForm((f) => ({ ...f, open: true }))} />
        </View>
      ) : null}

      {offerForm.open ? (
        <Card raised style={{ marginTop: space.sm }}>
          <Stack>
            <Text variant="h3">Your car</Text>
            <Row>
              {(['both', 'to', 'from'] as RideDirection[]).map((d) => (
                <Chip key={d} label={dirLabel[d]} selected={offerForm.direction === d} onPress={() => setOfferForm((f) => ({ ...f, direction: d }))} />
              ))}
            </Row>
            <Input label="Open seats" keyboardType="number-pad" value={offerForm.seats} onChangeText={(v) => setOfferForm((f) => ({ ...f, seats: v }))} />
            <Input
              label="Pickup note"
              placeholder="Leaving from the Starbucks on Bridgeport at 8:15"
              value={offerForm.note}
              onChangeText={(v) => setOfferForm((f) => ({ ...f, note: v }))}
            />
            {/* The same parent drives to the same practice every week. Asking them thirty
                times a season is why carpool threads die by October. */}
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Text variant="bodyMedium">Every {weekdayName}</Text>
                <Text variant="small" color="muted">
                  Post this car for every {eventTypeWord} on this day, this season.
                </Text>
              </View>
              <Switch value={offerForm.repeat} onValueChange={(v) => setOfferForm((f) => ({ ...f, repeat: v }))} trackColor={{ true: t.accent }} />
            </Row>
            <Row>
              <View style={{ flex: 1 }}>
                <Button title={offerForm.repeat ? 'Post every week' : 'Post ride'} onPress={offerRide} />
              </View>
              <Button title="Cancel" kind="ghost" onPress={() => setOfferForm((f) => ({ ...f, open: false }))} />
            </Row>
          </Stack>
        </Card>
      ) : null}

      <Stack style={{ marginTop: space.md }} gap={space.sm}>
        {offers.map((o) => {
          const riders = requests.filter((r) => r.offer_id === o.id && r.status === 'matched');
          const isMine = o.driver_id === profile?.id;
          const full = riders.length >= o.seats;
          return (
            <Card key={o.id} rail={isMine ? t.accent : undefined} style={{ paddingLeft: isMine ? space.xl : space.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  <Avatar name={o.driver?.full_name || '?'} />
                  <View>
                    <Text variant="bodyBold">{isMine ? 'You' : o.driver?.full_name || 'Driver'}</Text>
                    <Text variant="small" color="muted">
                      {dirLabel[o.direction]} · {o.seats - riders.length} of {o.seats} seats open
                    </Text>
                  </View>
                </Row>
                {isMine ? <Chip label="Cancel ride" onPress={() => cancelOffer(o.id)} /> : full ? <Chip label="Full" /> : null}
              </Row>
              {/* The message a carpool needs and nobody sends, because sending it means
                  finding three phone numbers while holding car keys. */}
              {isMine && riders.length ? (
                <Row style={{ marginTop: space.md }} gap={space.sm}>
                  <View style={{ flex: 1 }}>
                    <Button title="Leaving now" size="sm" onPress={() => announceDeparture(o, 0)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="10 min out" kind="secondary" size="sm" onPress={() => announceDeparture(o, 10)} />
                  </View>
                </Row>
              ) : null}
              {o.pickup_note ? (
                <Text variant="small" style={{ marginTop: space.sm }}>
                  {o.pickup_note}
                </Text>
              ) : null}
              {!isMine && o.driver?.phone ? (
                <Pressable onPress={() => Linking.openURL(`sms:${o.driver!.phone}`)}>
                  <Text variant="small" color="accent" style={{ marginTop: 4 }}>
                    Text {o.driver.full_name.split(' ')[0]}
                  </Text>
                </Pressable>
              ) : null}
              {riders.length ? (
                <View style={{ marginTop: space.md, gap: space.sm }}>
                  <Divider />
                  {riders.map((r) => (
                    <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                      <Row gap={6}>
                        <Avatar name={r.athlete?.first_name ?? '?'} color={r.athlete?.color} size={22} />
                        <Text variant="small">
                          {r.athlete?.first_name} {r.athlete?.last_initial ? r.athlete.last_initial + '.' : ''}
                          <Text variant="small" color="muted">
                            {'  '}· {r.requester?.full_name?.split(' ')[0]}
                          </Text>
                        </Text>
                      </Row>
                      {isMine || r.requested_by === profile?.id ? <Chip label="Release" onPress={() => releaseRider(r)} /> : null}
                    </Row>
                  ))}
                </View>
              ) : null}
              {isMine && !full && openRequests.length ? (
                <View style={{ marginTop: space.md, gap: space.sm }}>
                  <Divider />
                  <Text variant="label" color="faint">
                    Pick up
                  </Text>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {openRequests.map((r) => (
                      <Chip key={r.id} label={`+ ${r.athlete?.first_name}`} tone="signal" onPress={() => takeRider(r, o)} />
                    ))}
                  </Row>
                </View>
              ) : null}
            </Card>
          );
        })}
        {offers.length === 0 && !offerForm.open ? (
          <Text variant="small" color="muted">
            No one has offered a ride yet. Drivers see who needs a seat and tap to pick them up.
          </Text>
        ) : null}
      </Stack>
    </>
  );
}
