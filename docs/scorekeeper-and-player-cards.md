# Scorekeeper and player cards (idea captured 2026-09-07)

Source: Seri and Trisha, voice brainstorm.

## The idea
Every game already has a parent keeping score on the sideline. Give that parent a button. The roster is already in the app, so scoring is: tap the player, tap the points. Home and away, opponent picked from the same database when the other team is also on Huddle Up, otherwise typed once. Every tap lands in one Supabase dataset, walled off by team through RLS, which means per-kid stats accumulate across games, seasons, teams and sports without anyone doing data entry after the game.

## Why it matters for money
This is the object families pay for. The team-side scoring button stays free (it is what gets the scorekeeper to install). Family Plus unlocks the player card: a photo card that flips to show current-season stats and every prior season. Parents keep it because it is the record of their kid's sports life, and that record is what makes households stay through team changes. At 14+, the same card becomes the scout-facing profile.

## Fit with the plan
- Release 1 candidate, right after carpools prove the habit. It is the fastest path from "useful" to "worth $59 a year."
- It is GameChanger's home turf for baseball and softball, which is why we launch in soccer and basketball where GameChanger's scoring is weak.
- Keep it deliberately simple: goals, assists, saves, shots for soccer; points, rebounds, assists, steals for basketball. No play-by-play. One thumb.

## Data model sketch
- games (event_id, home_team_id, away_team_id nullable, away_team_name, final_home, final_away, scorekeeper_id, status)
- stat_events (game_id, athlete_id, stat_type, value, at, recorded_by) append-only, so a bad tap is an undo row, never a delete
- athlete_season_stats materialized view: sum by athlete, team, season, stat_type
- Player card reads the view; free users see the current game, Family Plus sees the archive

## Open questions
- Validation: two parents scoring the same game. Answer to test: one scorekeeper per game, claimable, others watch live.
- Opponent kids: never named unless their own household is on the app and consents. Away team shows as a team, not as children.
- Realtime: the same Supabase channel pattern the carpool board uses, so grandparents can follow the score from home.
