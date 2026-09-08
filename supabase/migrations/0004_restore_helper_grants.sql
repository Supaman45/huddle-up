-- RLS policy expressions execute as the calling role, so the helper functions used inside
-- policies must be executable by authenticated. They are stable, security definer, and read-only.
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_staff(uuid) to authenticated;
grant execute on function public.can_see_athlete(uuid) to authenticated;
