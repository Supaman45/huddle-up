import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Athlete, Household, Profile } from '@/lib/types';

interface SessionState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  household: Household | null;
  athletes: Athlete[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setHousehold(null);
      setAthletes([]);
      return;
    }
    const [{ data: p }, { data: hm }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('household_members').select('household:households(*)').eq('profile_id', s.user.id).limit(1).maybeSingle(),
    ]);
    setProfile((p as Profile) ?? null);
    const h = (hm as unknown as { household: Household } | null)?.household ?? null;
    setHousehold(h);
    if (h) {
      const { data: a } = await supabase.from('athletes').select('*').eq('household_id', h.id).order('created_at');
      setAthletes((a as Athlete[]) ?? []);
    } else {
      setAthletes([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await load(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await load(s);
      setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, household, athletes, refresh, signOut }),
    [ready, session, profile, household, athletes, refresh, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
