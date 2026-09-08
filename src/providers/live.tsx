import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session';

/**
 * The live layer.
 *
 * The app's whole promise is that a parent finds out. That cannot be one screen's private
 * subscription, which is what it was: the event screen listened, and Home did not, so
 * cancelling a ride updated the screen you happened to be on and nothing else.
 *
 * One channel for the session, every screen listening. Row-level security decides what
 * actually arrives, so subscribing broadly leaks nothing: the server only forwards rows this
 * parent is allowed to read.
 *
 * Screens do not consume payloads. They re-run the load they already had, because a refetch
 * is always right and patching state from a payload is right only until the first join or
 * derived count changes. `touched` exists purely so a card can flash the thing that moved.
 */
const TABLES = [
  'events',
  'carpool_offers',
  'carpool_requests',
  'rsvps',
  'signup_slots',
  'signup_claims',
  'games',
  'activity',
  'athlete_away',
  'messages',
  'trips',
  'trip_attendance',
] as const;

/** How long a touched entry is worth keeping. Longer than any flash, short enough to bound. */
const TOUCH_TTL_MS = 120_000;

interface Tick {
  /** Bumps once per burst of changes. */
  version: number;
  /** event_id -> when it last changed. State, not a ref, so reading it during render is safe. */
  touched: Map<string, number>;
}

interface LiveValue extends Tick {
  connected: boolean;
}

const EMPTY: LiveValue = { version: 0, touched: new Map(), connected: false };
const Ctx = createContext<LiveValue>(EMPTY);

/** Deletes carry a full old row because those tables are REPLICA IDENTITY FULL. */
function eventIdOf(payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }): string | null {
  const fresh = payload.new && Object.keys(payload.new).length ? payload.new : null;
  const row = fresh ?? payload.old ?? {};
  const id = row.event_id ?? (row as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [tick, setTick] = useState<Tick>({ version: 0, touched: new Map() });
  const [connected, setConnected] = useState(false);

  // Collected between bumps. A ref is right here because nothing renders from it directly:
  // it is drained into state when the debounce fires.
  const pending = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile) return;

    // One write can fire several row events. Coalescing into a single bump keeps a
    // scorekeeper tapping quickly from triggering a refetch per tap.
    const bump = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const drained = pending.current;
        pending.current = new Map();
        setTick((prev) => {
          const now = Date.now();
          const touched = new Map(prev.touched);
          for (const [id, at] of drained) touched.set(id, at);
          // Bounded: without this the map grows for the life of the session.
          for (const [id, at] of touched) if (now - at > TOUCH_TTL_MS) touched.delete(id);
          return { version: prev.version + 1, touched };
        });
      }, 250);
    };

    const channel = supabase.channel(`live-${profile.id}`);
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        const eventId = eventIdOf(payload as never);
        if (eventId) pending.current.set(eventId, Date.now());
        bump();
      });
    }

    channel.subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = new Map();
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [profile]);

  // tick is replaced wholesale on every bump, so this object is stable between bumps.
  const value: LiveValue = { version: tick.version, touched: tick.touched, connected };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Re-runs `load` whenever anything this parent can see changes. Screens keep their own
 * fetch; this only decides when to call it.
 */
export function useLive(load: () => void | Promise<void>) {
  const { version } = useContext(Ctx);
  const seen = useRef(version);
  const latest = useRef(load);

  // Kept current in an effect rather than during render: a screen's `load` is a new function
  // every render, and depending on it directly would refetch in a loop. This effect is
  // declared first, so it has already run by the time the version effect below fires.
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    // The screen's own focus effect does the first load; this fires only on real changes.
    if (version === seen.current) return;
    seen.current = version;
    latest.current();
  }, [version]);
}

/**
 * When this event last changed, or undefined if it has not while the app has been open.
 * A timestamp rather than a boolean, so the caller reacts to the change in an effect instead
 * of asking "is it recent" during render, which would need the clock and would not be pure.
 */
export function useEventChangedAt(eventId: string | null | undefined): number | undefined {
  const { touched } = useContext(Ctx);
  return eventId ? touched.get(eventId) : undefined;
}

export function useLiveConnected(): boolean {
  return useContext(Ctx).connected;
}
