# Huddle Up

The youth sports team app that is free to the team, forever. Carpools, snack and volunteer signups, and one merged household calendar across every kid and every team, imported from TeamSnap, SportsEngine or GameChanger. No ads. Kids are records inside a parent-owned household and never have accounts.

## Get running (Mac)
1. `git clone` this repo, then `cd huddle-up && npm install`
2. `cp .env.example .env` (the publishable key in there is safe to ship; RLS does the protecting)
3. `npx expo start`, press `i` for the iOS simulator or scan the QR code with Expo Go
4. In Supabase → Authentication → Email Templates → Magic Link, make sure the body includes `{{ .Token }}` so the six-digit code is in the email

## What is in Release 0
- Email code sign-in, household setup with kids, invite other adults
- Team Space by six-character code, deep link `huddleup://join/CODE`
- Schedule import from any ICS link, hourly via `ics-sync` edge function, on-demand from the team page
- Carpool board: offer seats, request rides per kid, drivers pick up riders, live updates
- Snack, volunteer and equipment slots with one-tap claims
- Notification preferences (per-kid controls arrive with Release 1)

## Next
See `docs/scorekeeper-and-player-cards.md` for the Release 1 paid feature and `CLAUDE.md` for conventions.
