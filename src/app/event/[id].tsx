import { formatDistanceToNowStrict } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { CarIcon, PencilIcon, PinIcon, SnackIcon } from '@/components/icons';
import { Avatar, Button, NavBar, Card, Chip, Divider, Input, Loading, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { dayLabel, rangeLabel, timeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { fonts, space, useTheme } from '@/lib/theme';
import type { Athlete, CarpoolOffer, CarpoolRequest, Event, EventType, Game, RideDirection, Rsvp, RsvpStatus, SignupSlot, Team, TeamRole } from '@/lib/types';
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
  const [myRole, setMyRole] = useState<TeamRole | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; title: string; type: EventType; when: Date; minutes: string; location: string; notes: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [nudging, setNudging] = useState(false);

  const load = useCallback(async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
    if (!ev) return;
    setEvent(ev as Event);
    const [{ data: tm }, { data: of }, { data: rq }, { data: sl }, { data: ta }, { data: rs }, { data: gm }, { data: me }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', ev.team_id).single(),
      supabase.from('carpool_offers').select('*, driver:profiles(*)').eq('event_id', id).order('created_at'),
      supabase.from('carpool_requests').select('*, athlete:athletes(*), requester:profiles(*)').eq('event_id', id).neq('status', 'cancelled').order('created_at'),
      supabase.from('signup_slots').select('*, claims:signup_claims(*, profile:profiles(*))').eq('event_id', id).order('created_at'),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', ev.team_id),
      supabase.from('rsvps').select('*, athlete:athletes(*)').eq('event_id', id),
      supabase.from('games').select('*').eq('event_id', id).maybeSingle(),
      supabase.from('team_members').select('role').eq('team_id', ev.team_id).eq('profile_id', profile!.id).maybeSingle(),
    ]);
    setMyRole((me as { role: TeamRole } | null)?.role ?? null);
    setTeam(tm as Team);
    setOffers((of as CarpoolOffer[]) ?? []);
    setRequests((rq as CarpoolRequest[]) ?? []);
    setSlots((sl as SignupSlot[]) ?? []);
    setRoster(((ta as unknown as { athlete: Athlete }[]) ?? []).map((r) => r.athlete));
    setRsvps((rs as Rsvp[]) ?? []);
    setGame((gm as Game) ?? null);
  }, [id, profile]);

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
  const isStaff = myRole === 'manager' || myRole === 'coach';
  const seatsOpen = offers.reduce((n, o) => n + Math.max(0, o.seats - seatsTaken(o.id)), 0);
  const othersWaiting = openRequests.filter((r) => r.requested_by !== profile?.id);
  const iAmWaiting = openRequests.some((r) => r.requested_by === profile?.id);

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

  // Rescheduling is the single most disruptive thing a coach does, so it gets its own
  // path: one form, one save, and the change lands in every family's What changed feed.
  function beginEdit() {
    if (!event) return;
    const mins = event.ends_at ? Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000) : 60;
    setEdit({
      open: true,
      title: event.title,
      type: event.type,
      when: new Date(event.starts_at),
      minutes: String(mins),
      location: event.location_name ?? '',
      notes: event.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!edit || !event) return;
    if (!edit.title.trim()) return Alert.alert('Give the event a title.');
    setSavingEdit(true);
    const mins = Math.max(15, Number(edit.minutes) || 60);
    const moved = edit.when.getTime() !== new Date(event.starts_at).getTime();
    const relocated = (edit.location.trim() || null) !== event.location_name;
    const { error } = await supabase
      .from('events')
      .update({
        title: edit.title.trim(),
        type: edit.type,
        starts_at: edit.when.toISOString(),
        ends_at: new Date(edit.when.getTime() + mins * 60000).toISOString(),
        location_name: edit.location.trim() || null,
        notes: edit.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSavingEdit(false);
    if (error) return toast(error.message, { tone: 'error' });
    setEdit(null);
    toast(moved || relocated ? 'Saved. Every family sees the change in What changed.' : 'Saved');
    await load();
  }

  function confirmCancel() {
    if (!event) return;
    const next = !event.cancelled;
    Alert.alert(
      next ? 'Cancel this event?' : 'Put it back on?',
      next
        ? 'It stays on the schedule with a line through it, and every family sees the cancellation.'
        : 'Families see it return to the schedule.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: next ? 'Cancel event' : 'Restore',
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase.from('events').update({ cancelled: next, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) return toast(error.message, { tone: 'error' });
            toast(next ? 'Cancelled. The team has been told.' : 'Back on the schedule.', { tone: next ? 'signal' : 'success' });
            await load();
          },
        },
      ],
    );
  }

  async function nudge() {
    if (!event || !unanswered.length) return;
    setNudging(true);
    const when = `${dayLabel(new Date(event.starts_at))} ${timeLabel(new Date(event.starts_at))}`;
    const names = unanswered.map((a) => a.first_name).join(', ');
    const { error } = await supabase.from('messages').insert({
      team_id: event.team_id,
      author_id: profile!.id,
      event_id: event.id,
      body: `Still need a yes or no for ${event.title}, ${when}. Waiting on: ${names}. Tap the event and tick Going or Out.`,
    });
    setNudging(false);
    if (error) return toast(error.message, { tone: 'error' });
    toast('Posted in team chat');
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
        {isStaff && !edit?.open ? (
          <Pressable onPress={beginEdit} accessibilityLabel="Edit event" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <PencilIcon color={t.muted} size={20} />
          </Pressable>
        ) : null}
      </Row>

      {/* ---------- Reschedule, move, cancel ---------- */}
      {isStaff && edit?.open ? (
        <Card raised style={{ marginTop: space.lg }}>
          <Stack>
            <Text variant="h3">Edit event</Text>
            <Row style={{ flexWrap: 'wrap' }}>
              {(['practice', 'game', 'tournament', 'other'] as EventType[]).map((k) => (
                <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={edit.type === k} onPress={() => setEdit((e) => (e ? { ...e, type: k } : e))} />
              ))}
            </Row>
            <Input label="Title" value={edit.title} onChangeText={(v) => setEdit((e) => (e ? { ...e, title: v } : e))} />
            <DateTimeField label="Starts" value={edit.when} onChange={(d) => setEdit((e) => (e ? { ...e, when: d } : e))} />
            <Row>
              <View style={{ flex: 1 }}>
                <Input label="Length (min)" keyboardType="number-pad" value={edit.minutes} onChangeText={(v) => setEdit((e) => (e ? { ...e, minutes: v } : e))} />
              </View>
              <View style={{ flex: 2 }}>
                <Input label="Location" value={edit.location} onChangeText={(v) => setEdit((e) => (e ? { ...e, location: v } : e))} placeholder="Fort Steilacoom Park, Field 4" />
              </View>
            </Row>
            <Input label="Note to the team" value={edit.notes} onChangeText={(v) => setEdit((e) => (e ? { ...e, notes: v } : e))} placeholder="Bring both jerseys" />
            {event.source === 'ics' ? (
              <Text variant="small" color="signal">
                This event came from the linked calendar. The next hourly sync overwrites your edits unless the source changes too.
              </Text>
            ) : null}
            <Row>
              <View style={{ flex: 1 }}>
                <Button title="Save changes" onPress={saveEdit} loading={savingEdit} />
              </View>
              <Button title="Back" kind="ghost" onPress={() => setEdit(null)} />
            </Row>
            <Divider />
            <Button title={event.cancelled ? 'Put this event back on' : 'Cancel this event'} kind={event.cancelled ? 'secondary' : 'danger'} onPress={confirmCancel} />
          </Stack>
        </Card>
      ) : null}

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

      {/* ---------- Headcount, for whoever is running the team ----------
          A coach asks one question the night before: how many bodies am I planning for.
          Chasing the missing answers goes through team chat, which is a channel that
          works today, rather than a push notification that does not. */}
      {isStaff ? (
        <>
          <SectionHeader title="Headcount" right={<Chip label={`${going.length}/${roster.length}`} tone={going.length >= roster.length - out.length ? 'accent' : undefined} />} />
          <Card raised>
            <Row style={{ justifyContent: 'space-between' }}>
              {[
                ['Going', going.length, t.accent],
                ['Out', out.length, t.faint],
                ['No answer', unanswered.length, unanswered.length ? t.signal : t.faint],
              ].map(([label, n, c]) => (
                <View key={label as string} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 34, color: c as string }}>{n as number}</Text>
                  <Text variant="label" color="faint">
                    {label as string}
                  </Text>
                </View>
              ))}
            </Row>
            {unanswered.length ? (
              <>
                <Divider />
                <Text variant="small" color="muted" style={{ marginTop: space.md }}>
                  Still waiting on {unanswered.map((a) => a.first_name).join(', ')}.
                </Text>
                <View style={{ marginTop: space.md }}>
                  <Button title={nudging ? 'Posting' : `Nudge ${unanswered.length} ${unanswered.length === 1 ? 'family' : 'families'}`} kind="secondary" onPress={nudge} loading={nudging} />
                </View>
                <Text variant="small" color="faint" style={{ marginTop: space.sm }}>
                  Posts one message in team chat. No one gets singled out in a text thread.
                </Text>
              </>
            ) : (
              <Text variant="small" color="muted" style={{ marginTop: space.md }}>
                Everyone has answered.
              </Text>
            )}
          </Card>
        </>
      ) : null}

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
                    <Button
                      title={`Text ${driver.driver.full_name.split(' ')[0]}`}
                      kind="secondary"
                      size="sm"
                      onPress={() => Linking.openURL(`sms:${driver.driver!.phone}`)}
                    />
                  </View>
                ) : null}
                {waiting ? (
                  <Text variant="small" color="faint" style={{ marginTop: space.sm, marginLeft: 44 }}>
                    {seatsOpen > 0
                      ? `${seatsOpen} open ${seatsOpen === 1 ? 'seat' : 'seats'} on this team right now.`
                      : 'No open seats yet. Every driver on the team sees this.'}
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
                {myOffer && seatsTaken(myOffer.id) < myOffer.seats ? (
                  <Button title="Take" size="sm" onPress={() => takeRider(r, myOffer)} />
                ) : null}
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
