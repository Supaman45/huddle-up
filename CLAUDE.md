# Huddle Up

Youth sports team app. Free to the team forever; households pay for Family Plus; local sponsors (adults only) from season 2. No third-party ads, ever. Kids are records inside a parent-owned household and never have accounts.

## Stack
- Expo SDK 57, Expo Router (file routes in `src/app`), TypeScript, React Native 0.86.
- Supabase project `huddle-up` (ref ftaxrqwsscitsqrqedxm, us-west-1): Postgres + Auth (email OTP) + Realtime + Edge Functions.
- Schema and RLS live in `supabase/migrations`. Never bypass RLS in app code; add a policy or an RPC instead.
- `supabase/functions/ics-sync` imports TeamSnap / SportsEngine / GameChanger calendar feeds, hourly via pg_cron.
- The `activity` table is written ONLY by SECURITY DEFINER triggers. Clients read it through
  `my_activity` / `unread_activity` and never insert. See `docs/activity-and-carpool.md`.

## Conventions
- UI primitives in `src/components/ui`. Tokens in `src/lib/theme.ts` (turf green accent, cone orange for ride alerts only).
- Copy is written from the parent's side: "I can drive", "needs a ride", "I've got it". No system jargon.
- Two colors carry meaning: orange = unresolved, someone must act. Green = settled. Team color
  rails a card when neither applies. Gold is Family Plus only.
- Never offer an action the state makes nonsense, such as "I can drive" to a parent whose own
  kid is waiting on a ride.
- RLS helpers used inside policy expressions (`is_team_member`, `is_team_staff`,
  `is_household_*`) MUST keep EXECUTE for `authenticated` — policies run as the caller.
- Data rules: children shown as first name + last initial only; adult phone numbers visible only within a shared team; media_consent defaults to household.
- Read https://docs.expo.dev/versions/v57.0.0/ before touching native modules.

## Run
```
cp .env.example .env
npm install
npx expo start
```
Supabase Auth: set the "Magic Link" email template to include `{{ .Token }}` so the six-digit code arrives (Dashboard → Authentication → Email Templates).
Deploy the sync function: `npx supabase functions deploy ics-sync --project-ref ftaxrqwsscitsqrqedxm`, the hourly pg_cron job is already scheduled (see `supabase/migrations/0009_hourly_sync.sql`).
