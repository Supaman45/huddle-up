import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';

import { CarIcon, PinIcon, SnackIcon } from '@/components/icons';
import { Avatar, Button, NavBar, Card, Chip, Divider, Input, Loading, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { dayLabel, rangeLabel, timeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { Athlete, CarpoolOffer, CarpoolRequest, Event, Game, RideDirection, Rsvp, RsvpStatus, SignupSlot, Team } from '@/lib/types';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const dirLabel: Record<RideDirection, string> = { to: 'There', from: 'Back', both: 'Both ways' };

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { profile, athletes } = useSession();
  const toast = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [offers, setOffers] = useState<CarpoolOffer[]>([]);
  const [requests, setRequests] = useState<CarpoolRequest[]>([]);
  const [slots, setSlots] = useState<SignupSlot[]>([]);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [offerForm, setOfferForm] = useState<{ open: boolean; seats: string; direction: RideDirection; note: string }>({ open: false, seats: '2', direction: 'both', note: '' });
  const [slotForm, setSlotForm] = useState<{ open: boolean; title: string; kind: SignupSlot['kind']; needed: string }>({ open: false, title: '', kind: 'snack', needed: '1' });

  const load = useCallback(async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
    if (!ev) return;
    setEvent(ev as Event);
    const [{ data: tm }, { data: of }, { data: rq }, { data: sl }, { data: ta }, { data: rs }, { data: gm }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', ev.team_id).single(),
      supabase.from('carpool_offers').select('*, driver:profiles(*)').eq('event_id', id).order('created_at'),
      supabase.from('carpool_requests').select('*, athlete:athletes(*), requester:profiles(*)').eq('event_id', id).neq('status', 'cancelled').order('created_at'),
      supabase.from('signup_slots').select('*, claims:signup_claims(*, profile:profiles(*))').eq('event_id', id).order('created_at'),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', ev.team_id),
      supabase.from('rsvps').select('*, athlete:athletes(*)').eq('event_id', id),
      supabase.from('games').select('*').eq('event_id', id).maybeSingle(),
    ]);
    setTeam(tm as Team);
    setOffers((of as CarpoolOffer[]) ?? []);
    setRequests((rq as CarpoolRequest[]) ?? []);
    setSlots((sl as SignupSlot[]) ?? []);
    setRoster(((ta as unknown as { athlete: Athlete }[]) ?? []).map((r) => r.athlete));
    setRsvps((rs as Rsvp[]) ?? []);
    setGame((gm as Game) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const ch = supabase
      .channel(`event-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carpool_offers', filter: `event_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carpool_requests', filter: `event_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `event_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signup_claims' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signup_slots', filter: `event_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  if (!event || !team) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const myKidsOnTeam = athletes.filter((a) => roster.some((r) => r.id === a.id));
  const myOffer = offers.find((o) => o.driver_id === profile?.id);
  const arrive = event.arrive_minutes ?? team.default_arrive_minutes;
  const arriveAt = new Date(start.getTime() - arrive * 60000);
  const going = rsvps.filter((r) => r.status === 'going');
  const out = rsvps.filter((r) => r.status === 'out');
  const unanswered = roster.filter((a) => !rsvps.some((r) => r.athlete_id === a.id));
  const openRequests = requests.filter((r) => r.status === 'open');

  function seatsTaken(offerId: string) {
    return requests.filter((r) => r.offer_id === offerId && r.status === 'matched').length;
  }

  async function setRsvp(athleteId: string, status: RsvpStatus) {
    const current = rsvps.find((r) => r.athlete_id === athleteId);
    if (current?.status === status) {
      await supabase.from('rsvps').delete().eq('event_id', id).eq('athlete_id', athleteId);
    } else {
      const { error } = await supabase.from('rsvps').upsert({ event_id: id, athlete_id: athleteId, status, set_by: profile!.id, updated_at: new Date().toISOString() }, { onConflict: 'event_id,athlete_id' });
      if (error) toast(error.message, { tone: 'error' });
      else {
        const kid = athletes.find((a) => a.id === athleteId)?.first_name ?? 'Kid';
        toast(status === 'going' ? `${kid} is going` : status === 'out' ? `${kid} is out` : `${kid} is a maybe`);
      }
    }
    await load();
  }

  async function offerRide() {
    const seats = Number(offerForm.seats);
    if (!seats || seats < 1) return Alert.alert('How many seats can you take?');
    const { error } = await supabase.from('carpool_offers').insert({ event_id: id, driver_id: profile!.id, direction: offerForm.direction, seats, pickup_note: offerForm.note.trim() || null });
    if (error) return toast(error.message, { tone: 'error' });
    setOfferForm({ open: false, seats: '2', direction: 'both', note: '' });
    toast(`You're driving · ${seats} ${seats === 1 ? 'seat' : 'seats'} open`);
  }

  async function cancelOffer(offerId: string) {
    await supabase.from('carpool_requests').update({ offer_id: null, status: 'open' }).eq('offer_id', offerId);
    await supabase.from('carpool_offers').delete().eq('id', offerId);
    toast('Ride cancelled. Riders were moved back to needing a ride.', { tone: 'signal' });
  }

  async function requestRide(athleteId: string) {
    const { error } = await supabase.from('carpool_requests').insert({ event_id: id, athlete_id: athleteId, requested_by: profile!.id, direction: 'both' });
    if (error && !error.message.includes('duplicate')) return toast(error.message, { tone: 'error' });
    const kid = athletes.find((a) => a.id === athleteId)?.first_name ?? 'Kid';
    toast(`Ride requested for ${kid}. Drivers on the team can see it now.`);
  }

  async function cancelRequest(reqId: string) {
    await supabase.from('carpool_requests').delete().eq('id', reqId);
    toast('Ride request cancelled', { tone: 'signal' });
  }

  async function takeRider(req: CarpoolRequest, offer: CarpoolOffer) {
    if (seatsTaken(offer.id) >= offer.seats) return Alert.alert('That car is full.');
    const { error } = await supabase.from('carpool_requests').update({ offer_id: offer.id, status: 'matched' }).eq('id', req.id);
    if (error) return toast(error.message, { tone: 'error' });
    toast(`${req.athlete?.first_name ?? 'Rider'} is in your car. ${req.requester?.full_name?.split(' ')[0] ?? 'Their parent'} has been told.`);
  }

  async function releaseRider(req: CarpoolRequest) {
    await supabase.from('carpool_requests').update({ offer_id: null, status: 'open' }).eq('id', req.id);
    toast(`${req.athlete?.first_name ?? 'Rider'} needs a ride again`, { tone: 'signal' });
  }

  async function addSlot() {
    if (!slotForm.title.trim()) return Alert.alert('Name the slot, like "Orange slices" or "Line the field".');
    const { error } = await supabase.from('signup_slots').insert({ event_id: id, kind: slotForm.kind, title: slotForm.title.trim(), needed: Math.max(1, Number(slotForm.needed) || 1), created_by: profile!.id });
    if (error) return toast(error.message, { tone: 'error' });
    setSlotForm({ open: false, title: '', kind: 'snack', needed: '1' });
    toast('Slot added. The team can claim it now.');
  }

  async function claim(slot: SignupSlot) {
    const mine = slot.claims?.find((c) => c.profile_id === profile?.id);
    if (mine) {
      await supabase.from('signup_claims').delete().eq('id', mine.id);
      toast(`You're off ${slot.title}`, { tone: 'signal' });
    } else {
      await supabase.from('signup_claims').insert({ slot_id: slot.id, profile_id: profile!.id });
      toast(`You've got ${slot.title}. We'll remind you the day before.`);
    }
  }

  function openMaps() {
    const q = encodeURIComponent(event!.location_address || event!.location_name || '');
    const url = Platform.select({ ios: `maps:0,0?q=${q}`, default: `https://www.google.com/maps/search/?api=1&query=${q}` });
    Linking.openURL(url!);
  }

  return (
    <Screen glow>
      <NavBar />
      <Row style={{ alignItems: 'stretch' }} gap={space.md}>
        <View style={{ width: 5, borderRadius: 3, backgroundColor: team.color }} />
        <View style={{ flex: 1 }}>
          <Text variant="label" color="faint">
            {team.name} · {event.type}
          </Text>
          <Text variant="display" style={{ marginTop: 4 }}>
            {event.title}
          </Text>
        </View>
      </Row>

      <Card raised style={{ marginTop: space.lg, gap: space.md }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text variant="mono" color="accent">
              {rangeLabel(start, end).toUpperCase()}
            </Text>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {dayLabel(start)}
            </Text>
          </View>
          <Chip label={`Arrive by ${timeLabel(arriveAt)}`} tone="accent" />
        </Row>
        {event.location_name || event.location_address ? (
          <Pressable onPress={openMaps} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Row gap={10}>
              <PinIcon color={t.accent} size={20} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{event.location_name ?? event.location_address}</Text>
                <Text variant="small" color="muted">
                  {event.location_address && event.location_name ? event.location_address : 'Tap for directions'}
                </Text>
              </View>
            </Row>
          </Pressable>
        ) : null}
        {event.notes ? (
          <Text variant="small" color="muted">
            {event.notes}
          </Text>
        ) : null}
        {event.cancelled ? (
          <Text variant="bodyBold" color="signal">
            This event is cancelled.
          </Text>
        ) : null}
      </Card>

      {/* ---------- Score ---------- */}
      {event.type === 'game' || event.type === 'tournament' ? (
        <Pressable onPress={() => router.push({ pathname: '/game/[id]', params: { id } })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: space.lg })}>
          <Card raised rail={game?.status === 'live' ? t.signal : t.accent} style={{ paddingLeft: space.xl }}>
            {game ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Row gap={6}>
                    {game.status === 'live' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.signal }} /> : null}
                    <Text variant="label" color={game.status === 'live' ? 'signal' : 'faint'}>
                      {game.status === 'live' ? 'Live now' : 'Final'}
                    </Text>
                  </Row>
                  <Text variant="h1" style={{ marginTop: 4 }}>
                    {game.our_score} · {game.their_score}
                  </Text>
                  <Text variant="small" color="muted">
                    {team.name} vs {game.opponent_name}
                  </Text>
                </View>
                <Chip label={game.scorekeeper_id === profile?.id ? 'Keep scoring' : 'Watch'} tone="accent" />
              </Row>
            ) : (
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">Keep score</Text>
                  <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                    Tap players, everyone watching sees the score, stats land on their player cards.
                  </Text>
                </View>
                <Chip label="Start" tone="accent" />
              </Row>
            )}
          </Card>
        </Pressable>
      ) : null}

      {/* ---------- RSVP ---------- */}
      {myKidsOnTeam.length ? (
        <>
          <SectionHeader title="Who's coming" right={<Text variant="small" color="muted">{`${going.length} going · ${out.length} out · ${unanswered.length} unanswered`}</Text>} />
          <Stack gap={space.sm}>
            {myKidsOnTeam.map((k) => {
              const mine = rsvps.find((r) => r.athlete_id === k.id)?.status;
              return (
                <Card key={k.id} rail={k.color} style={{ paddingLeft: space.xl }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Pressable onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: k.id } })}>
                      <Row>
                        <Avatar name={k.first_name} color={k.color} size={30} />
                        <Text variant="bodyBold">{k.first_name}</Text>
                      </Row>
                    </Pressable>
                    <Row gap={6}>
                      <Chip label="Going" selected={mine === 'going'} onPress={() => setRsvp(k.id, 'going')} />
                      <Chip label="Maybe" selected={mine === 'maybe'} onPress={() => setRsvp(k.id, 'maybe')} />
                      <Chip label="Out" selected={mine === 'out'} onPress={() => setRsvp(k.id, 'out')} />
                    </Row>
                  </Row>
                </Card>
              );
            })}
          </Stack>
          {going.length ? (
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }} gap={6}>
              {going.map((r) => (
                <Chip key={r.athlete_id} label={r.athlete?.first_name ?? ''} dot={r.athlete?.color} />
              ))}
            </Row>
          ) : null}
        </>
      ) : null}

      {/* ---------- Carpool board ---------- */}
      <SectionHeader
        title="Carpool board"
        right={openRequests.length ? <Chip label={`${openRequests.length} need${openRequests.length === 1 ? 's' : ''} a ride`} tone="signal" /> : <Chip label="Everyone's covered" tone="accent" />}
      />

      {myKidsOnTeam.length ? (
        <Row style={{ flexWrap: 'wrap', marginBottom: space.md }}>
          {myKidsOnTeam.map((k) => {
            const req = requests.find((r) => r.athlete_id === k.id);
            if (req) {
              return (
                <Chip
                  key={k.id}
                  label={req.status === 'matched' ? `${k.first_name}: ride set` : `${k.first_name} needs a ride · tap to cancel`}
                  tone={req.status === 'matched' ? 'accent' : 'signal'}
                  onPress={() => cancelRequest(req.id)}
                />
              );
            }
            return <Chip key={k.id} label={`Request a ride for ${k.first_name}`} onPress={() => requestRide(k.id)} />;
          })}
        </Row>
      ) : null}

      {/* Same rule as the home card: while one of your own kids is waiting on a driver,
          offering a car makes no sense. Cancel the request and the button comes back. */}
      {myKidsOnTeam.some((k) => requests.find((r) => r.athlete_id === k.id)?.status === 'open') ? (
        <Text variant="small" color="muted">
          Cancel your ride request above if you end up driving after all.
        </Text>
      ) : !myOffer && !offerForm.open ? (
        <Button title="I can drive" icon={<CarIcon color={t.accentInk} size={20} />} onPress={() => setOfferForm((f) => ({ ...f, open: true }))} />
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
            <Input label="Pickup note" placeholder="Leaving from the Starbucks on Bridgeport at 8:15" value={offerForm.note} onChangeText={(v) => setOfferForm((f) => ({ ...f, note: v }))} />
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Post ride" onPress={offerRide} />
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
        {openRequests.length ? (
          <Card style={{ borderColor: t.signal }}>
            <Text variant="label" color="signal">
              Still need rides
            </Text>
            {openRequests.map((r) => (
              <Text key={r.id} style={{ marginTop: 4 }}>
                {r.athlete?.first_name} {r.athlete?.last_initial ? r.athlete.last_initial + '.' : ''} <Text color="muted">· ask {r.requester?.full_name?.split(' ')[0]}</Text>
              </Text>
            ))}
          </Card>
        ) : null}
      </Stack>

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
            <Input placeholder={slotForm.kind === 'snack' ? 'Orange slices and water' : slotForm.kind === 'volunteer' ? 'Line judge' : 'Bring the pop-up goals'} value={slotForm.title} onChangeText={(v) => setSlotForm((f) => ({ ...f, title: v }))} />
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
                <Chip label={mine ? "I'm out" : filled ? 'Covered' : "I've got it"} tone={mine ? 'neutral' : filled ? 'accent' : 'gold'} onPress={mine || !filled ? () => claim(s) : undefined} />
              </Row>
            </Card>
          );
        })}
      </Stack>
    </Screen>
  );
}
