import { format } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { CarpoolBoard, type OfferForm } from '@/components/event/carpool-board';
import { GettingThere } from '@/components/event/getting-there';
import { OfflineNote } from '@/components/offline-note';
import { SignupBoard, type SlotForm } from '@/components/event/signup-board';
import { PencilIcon } from '@/components/icons';
import { Avatar, Button, NavBar, Card, Chip, Divider, Input, Loading, Row, Screen, SectionHeader, Stack, Text } from '@/components/ui';
import { readCache, writeCache } from '@/lib/cache';
import { dayLabel, rangeLabel, timeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { fonts, space, useTheme } from '@/lib/theme';
import type { Athlete, CarpoolOffer, CarpoolRequest, Event, EventType, Game, Rsvp, RsvpStatus, SignupSlot, Team, TeamPlace, TeamRole } from '@/lib/types';
import { useLive } from '@/providers/live';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/** Everything this screen needs to be useful with no signal. */
interface EventSnapshot {
  event: Event;
  team: Team;
  offers: CarpoolOffer[];
  requests: CarpoolRequest[];
  slots: SignupSlot[];
  roster: Athlete[];
  rsvps: Rsvp[];
  place: TeamPlace | null;
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { profile, athletes } = useSession();
  // Read once, with optional chaining. The React Compiler hoists property reads out of
  // callbacks as memo dependencies, so `profile!.id` inside a handler is evaluated during
  // render, and on a deep link that happens before the session has resolved: null.id, crash.
  const uid = profile?.id ?? null;
  const toast = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [offers, setOffers] = useState<CarpoolOffer[]>([]);
  const [requests, setRequests] = useState<CarpoolRequest[]>([]);
  const [slots, setSlots] = useState<SignupSlot[]>([]);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>({ open: false, seats: '2', direction: 'both', note: '', repeat: false });
  const [slotForm, setSlotForm] = useState<SlotForm>({ open: false, title: '', kind: 'snack', needed: '1' });
  const [myRole, setMyRole] = useState<TeamRole | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; title: string; type: EventType; when: Date; minutes: string; location: string; notes: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [awayIds, setAwayIds] = useState<string[]>([]);
  const [place, setPlace] = useState<TeamPlace | null>(null);
  const [staleAt, setStaleAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    // Deep-linking straight to this screen on the web runs the first load before the session
    // provider has a profile. Returning here is correct: profile is in the dep list, so the
    // load re-runs the moment it arrives.
    if (!profile) return;
    const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (evErr || !ev) {
      // Standing at the field with one bar: show what we last saw, dated, rather than a
      // spinner over the details the parent came here for.
      const cached = await readCache<EventSnapshot>(`event.${id}`);
      if (cached) {
        setEvent(cached.value.event);
        setTeam(cached.value.team);
        setOffers(cached.value.offers);
        setRequests(cached.value.requests);
        setRoster(cached.value.roster);
        setRsvps(cached.value.rsvps);
        setSlots(cached.value.slots);
        setPlace(cached.value.place);
        setStaleAt(cached.at);
      }
      return;
    }
    setStaleAt(null);
    setEvent(ev as Event);
    const [{ data: tm }, { data: of }, { data: rq }, { data: sl }, { data: ta }, { data: rs }, { data: gm }, { data: me }, { data: aw }, { data: pl }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', ev.team_id).single(),
      supabase.from('carpool_offers').select('*, driver:profiles(*)').eq('event_id', id).order('created_at'),
      supabase.from('carpool_requests').select('*, athlete:athletes(*), requester:profiles(*)').eq('event_id', id).neq('status', 'cancelled').order('created_at'),
      supabase.from('signup_slots').select('*, claims:signup_claims(*, profile:profiles(*))').eq('event_id', id).order('created_at'),
      supabase.from('team_athletes').select('athlete:athletes(*)').eq('team_id', ev.team_id),
      supabase.from('rsvps').select('*, athlete:athletes(*)').eq('event_id', id),
      supabase.from('games').select('*').eq('event_id', id).maybeSingle(),
      supabase.from('team_members').select('role').eq('team_id', ev.team_id).eq('profile_id', profile.id).maybeSingle(),
      supabase.rpc('away_athletes', { p_event_id: id }),
      ev.location_name
        ? supabase.from('team_places').select('*').eq('team_id', ev.team_id).ilike('name', ev.location_name).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setMyRole((me as { role: TeamRole } | null)?.role ?? null);
    setAwayIds(aw ?? []);
    setPlace((pl as TeamPlace | null) ?? null);
    await writeCache<EventSnapshot>(`event.${id}`, {
      event: ev as Event,
      team: tm as Team,
      offers: of ?? [],
      requests: rq ?? [],
      slots: sl ?? [],
      roster: (ta ?? []).map((r) => r.athlete),
      rsvps: rs ?? [],
      place: (pl as TeamPlace | null) ?? null,
    });
    setTeam(tm as Team);
    setOffers(of ?? []);
    setRequests(rq ?? []);
    setSlots(sl ?? []);
    setRoster((ta ?? []).map((r) => r.athlete));
    setRsvps(rs ?? []);
    setGame((gm as Game) ?? null);
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLive(load);

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
  const noAnswer = roster.filter((a) => !rsvps.some((r) => r.athlete_id === a.id));
  // A family who told us in August that they are gone has answered. Counting them as
  // silent is what makes a coach chase people who already replied.
  const away = noAnswer.filter((a) => awayIds.includes(a.id));
  const unanswered = noAnswer.filter((a) => !awayIds.includes(a.id));
  const openRequests = requests.filter((r) => r.status === 'open');
  const isStaff = myRole === 'manager' || myRole === 'coach';
  const seatsOpen = offers.reduce((n, o) => n + Math.max(0, o.seats - seatsTaken(o.id)), 0);
  const othersWaiting = openRequests.filter((r) => r.requested_by !== profile?.id);
  const iAmWaiting = openRequests.some((r) => r.requested_by === profile?.id);

  function seatsTaken(offerId: string) {
    return requests.filter((r) => r.offer_id === offerId && r.status === 'matched').length;
  }

  async function setRsvp(athleteId: string, status: RsvpStatus) {
    if (!uid) return;
    const current = rsvps.find((r) => r.athlete_id === athleteId);
    if (current?.status === status) {
      await supabase.from('rsvps').delete().eq('event_id', id).eq('athlete_id', athleteId);
    } else {
      const { error } = await supabase
        .from('rsvps')
        .upsert({ event_id: id, athlete_id: athleteId, status, set_by: uid, updated_at: new Date().toISOString() }, { onConflict: 'event_id,athlete_id' });
      if (error) toast(error.message, { tone: 'error' });
      else {
        const kid = athletes.find((a) => a.id === athleteId)?.first_name ?? 'Kid';
        toast(status === 'going' ? `${kid} is going` : status === 'out' ? `${kid} is out` : `${kid} is a maybe`);
      }
    }
    await load();
  }

  async function offerRide() {
    if (!uid) return;
    const seats = Number(offerForm.seats);
    if (!seats || seats < 1) return Alert.alert('How many seats can you take?');
    const { error } = await supabase
      .from('carpool_offers')
      .insert({ event_id: id, driver_id: uid, direction: offerForm.direction, seats, pickup_note: offerForm.note.trim() || null });
    if (error) return toast(error.message, { tone: 'error' });
    setOfferForm({ open: false, seats: '2', direction: 'both', note: '', repeat: false });
    toast(`You're driving · ${seats} ${seats === 1 ? 'seat' : 'seats'} open`);
  }

  async function cancelOffer(offerId: string) {
    await supabase.from('carpool_requests').update({ offer_id: null, status: 'open' }).eq('offer_id', offerId);
    await supabase.from('carpool_offers').delete().eq('id', offerId);
    toast('Ride cancelled. Riders were moved back to needing a ride.', { tone: 'signal' });
  }

  async function requestRide(athleteId: string) {
    if (!uid) return;
    const { error } = await supabase.from('carpool_requests').insert({ event_id: id, athlete_id: athleteId, requested_by: uid, direction: 'both' });
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
    if (!uid) return;
    if (!slotForm.title.trim()) return Alert.alert('Name the slot, like "Orange slices" or "Line the field".');
    const { error } = await supabase
      .from('signup_slots')
      .insert({ event_id: id, kind: slotForm.kind, title: slotForm.title.trim(), needed: Math.max(1, Number(slotForm.needed) || 1), created_by: uid });
    if (error) return toast(error.message, { tone: 'error' });
    setSlotForm({ open: false, title: '', kind: 'snack', needed: '1' });
    toast('Slot added. The team can claim it now.');
  }

  async function claim(slot: SignupSlot) {
    if (!uid) return;
    const mine = slot.claims?.find((c) => c.profile_id === profile?.id);
    if (mine) {
      await supabase.from('signup_claims').delete().eq('id', mine.id);
      toast(`You're off ${slot.title}`, { tone: 'signal' });
    } else {
      await supabase.from('signup_claims').insert({ slot_id: slot.id, profile_id: uid });
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
      next ? 'It stays on the schedule with a line through it, and every family sees the cancellation.' : 'Families see it return to the schedule.',
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

  async function announceDeparture(offer: CarpoolOffer, minutes: number) {
    const { error } = await supabase.rpc('announce_departure', { p_offer_id: offer.id, p_minutes: minutes });
    if (error) return toast(error.message, { tone: 'error' });
    toast(minutes ? `Told the team you leave in ${minutes} min` : 'Told the team you are leaving');

    // The record is in the app; the message that actually reaches a phone today is a text.
    const numbers = requests
      .filter((r) => r.offer_id === offer.id && r.status === 'matched')
      .map((r) => r.requester?.phone)
      .filter((n): n is string => !!n)
      .map((n) => n.replace(/[^\d+]/g, ''));
    if (!numbers.length) return;
    const body = encodeURIComponent(minutes ? `Leaving in about ${minutes} minutes for ${event!.title}.` : `Leaving now for ${event!.title}.`);
    const to = numbers.join(',');
    Linking.openURL(Platform.OS === 'ios' ? `sms:${to}&body=${body}` : `sms:${to}?body=${body}`).catch(() => {});
  }

  async function nudge() {
    if (!uid) return;
    if (!event || !unanswered.length) return;
    setNudging(true);
    const when = `${dayLabel(new Date(event.starts_at))} ${timeLabel(new Date(event.starts_at))}`;
    const names = unanswered.map((a) => a.first_name).join(', ');
    const { error } = await supabase.from('messages').insert({
      team_id: event.team_id,
      author_id: uid,
      event_id: event.id,
      body: `Still need a yes or no for ${event.title}, ${when}. Waiting on: ${names}. Tap the event and tick Going or Out.`,
    });
    setNudging(false);
    if (error) return toast(error.message, { tone: 'error' });
    toast('Posted in team chat');
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

      {staleAt ? <OfflineNote at={staleAt} /> : null}

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

      <GettingThere
        teamId={event.team_id}
        locationName={event.location_name}
        locationAddress={event.location_address}
        place={place}
        isStaff={isStaff}
        createdBy={uid ?? ''}
        onSaved={load}
      />

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
                ['Away', away.length, t.faint],
                ['No answer', unanswered.length, unanswered.length ? t.signal : t.faint],
              ].map(([label, n, c]) => (
                <View key={label as string} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 30, color: c as string }}>{n as number}</Text>
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
                {away.length ? (
                  <Text variant="small" color="faint" style={{ marginTop: 4 }}>
                    {away.map((a) => a.first_name).join(', ')} {away.length === 1 ? 'is' : 'are'} away this week and will not be asked.
                  </Text>
                ) : null}
                <View style={{ marginTop: space.md }}>
                  <Button
                    title={nudging ? 'Posting' : `Nudge ${unanswered.length} ${unanswered.length === 1 ? 'family' : 'families'}`}
                    kind="secondary"
                    onPress={nudge}
                    loading={nudging}
                  />
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

      <CarpoolBoard
        profile={profile}
        myKidsOnTeam={myKidsOnTeam}
        offers={offers}
        requests={requests}
        openRequests={openRequests}
        othersWaiting={othersWaiting}
        iAmWaiting={iAmWaiting}
        myOffer={myOffer}
        seatsOpen={seatsOpen}
        seatsTaken={seatsTaken}
        offerForm={offerForm}
        setOfferForm={setOfferForm}
        requestRide={requestRide}
        cancelRequest={cancelRequest}
        offerRide={offerRide}
        cancelOffer={cancelOffer}
        takeRider={takeRider}
        releaseRider={releaseRider}
        announceDeparture={announceDeparture}
        weekdayName={format(start, 'EEEE')}
        eventTypeWord={event.type === 'game' ? 'game' : event.type === 'tournament' ? 'tournament' : 'practice'}
      />

      <SignupBoard profile={profile} slots={slots} slotForm={slotForm} setSlotForm={setSlotForm} addSlot={addSlot} claim={claim} />
    </Screen>
  );
}
