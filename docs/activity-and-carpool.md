# What changed, and how a carpool reads

Two features shipped together because they answer the same question from opposite sides:
*did anything happen that I need to deal with.*

## What changed (activity feed)

Push notifications are blocked on tooling, not on code. Expo Go dropped remote push in SDK 53
and the iOS simulator cannot receive it, so a phone alert needs an Apple Developer account and
a dev build on real hardware. Until then the app still has to keep its central promise: nobody
misses a field change.

The feed is that promise, kept in a place a parent can check.

**Where the rows come from.** Nothing writes to `activity` from the client. Four
`SECURITY DEFINER` triggers do:

| Trigger on | Fires when | Row it writes |
|---|---|---|
| `events` insert | a coach adds an event | `event_added` |
| `events` update | `starts_at` moves | `event_changed`, both times in the body |
| `events` update | `location_name` changes | `event_changed`, the new field |
| `events` update | `cancelled` flips true | `event_cancelled` |
| `carpool_requests` insert | a parent asks for a ride | `ride_needed` |
| `carpool_requests` update | status becomes `matched` | `ride_filled`, with the driver's name |
| `signup_claims` insert | someone takes the snack slot | `slot_claimed` |
| `games` update | status becomes `final` | `game_final`, with the score |

An update that changes nothing writes nothing, which matters because the hourly calendar sync
rewrites every imported event on every pass. Only a genuine move logs a change. An `ics` change
logs with a null actor, which reads as the schedule itself changing rather than a person doing it.

**Reading it.** `my_activity(limit)` returns rows for every team you belong to, newest first,
each flagged `is_new` when it landed after your last read and you were not the one who caused it.
`unread_activity()` is the badge count. `mark_activity_read()` stamps `activity_reads` when the
screen opens.

**Times are rendered in the team's timezone**, not the reader's, because "moved to Saturday at
9am" has to mean the same thing to a grandparent in Arizona as it does to the coach.

## The carpool, from both ends

A carpool is a handoff between two parents with opposite jobs, and the old layout served neither.

**The parent who needs a ride** wants certainty, in this order: did anyone take it, who is it,
and how do I reach them Saturday morning. Waiting is the anxious state, so it says how long it
has been waiting and how many seats exist on the team at all. A ride with no name attached is
not a ride, so `my_events` now carries `ride_driver`, `ride_driver_phone` and `ride_note`, and
the card says *Riding with Ryan* with a Text button rather than *Ride set*.

**The parent with seats** wants a target: how many kids need a ride, who, and can I take one on
the way. That list now sits *above* the cars rather than below them, with a Take button on each
row when you have an open seat. Their car is not the point; the kid without one is.

### Layout order on the event screen

1. Your own kids, one row each, and the row is the action.
2. Everyone else still waiting, in orange, with Take buttons.
3. The cars, yours first.

### Color

Two colors carry meaning and nothing else does.

- **Orange** means unresolved and someone has to act: a kid without a ride, a schedule change,
  a cancellation.
- **Green** means settled: ride matched, seats filled, event confirmed.

Team color rails the card when neither applies, so a family with two kids on two teams can tell
them apart at a glance. Gold is reserved for Family Plus and appears nowhere else.

### The button that went away

The hero card used to offer "I can drive" even to a parent who had just asked for a ride for
their own kid. Obviously if they could drive, their kid would not need a ride. That button is
now hidden whenever your own kid is waiting, and the remaining action takes the full width.

## Team identity

`teams.logo_path` and `teams.accent_color` let a coach put the club crest and colors on the
screen. Crests live at `<team_id>/brand/` in the `team-media` bucket.

Storage policies are OR'd, so the pre-existing "any member uploads anywhere in the team folder"
rule made a staff-only brand rule meaningless. The members rule was narrowed to exclude the
`brand` prefix before the staff rule meant anything. Worth remembering the next time a prefix
needs different permissions from its parent.

## Season

`team_record(team_id)` and `team_leaders(team_id)` turn the scorekeeper's raw stat events into
the two things anyone asks about: the record, and who leads the team in each stat. Both gate on
`is_team_member`, so stats never leave the team that made them.
