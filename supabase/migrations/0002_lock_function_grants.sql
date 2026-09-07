-- Nothing runs anonymously. Only the RPCs the app calls are exposed to signed-in users.
revoke execute on all functions in schema public from anon, public;
revoke execute on all functions in schema public from authenticated;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_household_member(uuid) from anon, authenticated, public;
revoke execute on function public.is_team_member(uuid) from anon, authenticated, public;
revoke execute on function public.is_team_staff(uuid) from anon, authenticated, public;
revoke execute on function public.can_see_athlete(uuid) from anon, authenticated, public;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_team(text, public.sport, text, text, text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.peek_team(text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.my_events(timestamptz, timestamptz) to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;
