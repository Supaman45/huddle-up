# Scorekeeper and player cards

Shipped 2026-09-08. Idea from Seri and Trisha.

## How it works
Every game already has a parent on the sideline. Give that parent a button.

- Open a game event, tap **Keep score**, name the opponent, pick home or away.
- The roster loads as a grid. Tap the kid, then tap the stat. Two taps, one thumb.
- The team score adds itself from scoring taps (a database trigger keeps `games.our_score` in sync with `stat_events`). The opponent score is a plus and minus button.
- Everyone else on the team who opens the event sees the score live, no scorekeeping controls.
- Undo removes the newest tap. End game marks it final.

## Stat sets, kept deliberately small
- Soccer: Goal, Assist, Shot, Save
- Basketball: 2 pt, 3 pt, Free throw, Rebound, Assist, Steal

## Player cards
`/athlete/[id]` is a flip card. Front is the kid, their team and a one-line season summary. Back is the stat table for the current season plus a career line. Below it, every season they have ever played, newest first, with per-stat totals.

Stats attach to the **athlete**, not the team, so they follow a kid across rosters, seasons and sports. That is the thing TeamSnap and GameChanger cannot do, and it is why a household stays subscribed after a team dissolves.

Reachable from: Household (tap a kid), Team → People (tap a player chip), Event → RSVP row (tap a kid).

## Money
The current season is free forever. Family Plus ($59/yr per household, not yet for sale) keeps every prior season, adds photos and clips to the card, and gives extra adults their own login. The card shows an honest "Soon" chip today; nothing is behind a paywall until Stripe is wired.

## Data model
- `games` — one row per event. `our_score` maintained by trigger, `their_score` manual, `scorekeeper_id` claims the game.
- `stat_events` — one row per tap, append-only in practice; undo deletes the newest row.
- `athlete_stat_totals` — view, totals by athlete, team, season, stat.
- `start_game(event_id, opponent, is_home)` — claims or joins.
- `athlete_card(athlete_id)` — everything a card needs in one call, gated by `can_see_athlete`.

RLS: only the claimed scorekeeper (or team staff) can write stats; any team member can read them.

## Not built yet
Opponent rosters (away kids are never named), per-play video, box score export, season leaderboards, push when the score changes.
