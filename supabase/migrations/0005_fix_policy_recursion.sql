-- household_members policies referenced household_members directly, which recurses under RLS.
-- Route every self-reference through security definer helpers.
create or replace function public.is_household_owner(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm where hm.household_id = hid and hm.profile_id = auth.uid() and hm.role = 'owner');
$$;
create or replace function public.shares_context_with(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid = auth.uid()
  or exists (select 1 from public.household_members a join public.household_members b on a.household_id = b.household_id
             where a.profile_id = auth.uid() and b.profile_id = pid)
  or exists (select 1 from public.team_members a join public.team_members b on a.team_id = b.team_id
             where a.profile_id = auth.uid() and b.profile_id = pid);
$$;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.shares_context_with(uuid) to authenticated;

drop policy "household_members: owner manage" on public.household_members;
create policy "household_members: owner manage" on public.household_members for all
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

drop policy "households: owner update" on public.households;
create policy "households: owner update" on public.households for update using (public.is_household_owner(id));

drop policy "profiles: self" on public.profiles;
drop policy "profiles: shared context" on public.profiles;
create policy "profiles: read" on public.profiles for select using (public.shares_context_with(id));
