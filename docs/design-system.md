# Huddle Up design system · Evening field (A1)

Chosen 2026-09-08 from three directions. Dark by default. Built for parents on a sideline at dusk, not for gamers.

## Tokens (src/lib/theme.ts)
- Ground: bg #0F1620 · surface #141D2B · surfaceAlt #1B2635 · surfaceRaised #1F2C3D
- Text: ink #EEF2F6 · inkStrong #F7F9FB · muted #A3AFBC · faint #6F7C8A
- Lines: line #26313F · lineStrong #2B3848
- Action: accent #8CD5A5 (sage) on accentInk #0E1A14. One primary button per view.
- Needs you: signal #F3A56B (apricot). Rides, cancellations, anything a parent must act on.
- Open slot: gold #F5B849. Snack and volunteer slots not yet covered.
- Kid colors: #F5B849 #6FA8FF #FF8A5B #C08BFF #5FD3C0 #FF7F9E #9BD65C #F0F0F0. The only saturated hues on screen.

## Type
- Display: Barlow Condensed 800 (headlines), 700 (card titles), 600 (labels).
- Text: Barlow 400 / 500 / 600.
- Times, codes, scores: JetBrains Mono 500, uppercase, letter-spaced.

## Components (src/components/ui)
- Card: `rail` paints a glowing left bar in the kid or status color; `raised` is the hero treatment with depth. One hero per list.
- Chip: neutral (pill, outlined) for filters and toggles; accent / signal / gold (square, uppercase) for status.
- Button: primary (sage), secondary (surface), ghost, signal, danger. 48px tall, 40px for `sm`.
- Glow: layered discs top-left on hero screens. Never more than one per screen.
- Segments: tab switcher inside a page.

## Rules
- Kids are shown by first name and last initial only.
- Copy is written from the parent's side of the screen. "I can drive", "Needs ride", "I've got it", "Everyone's covered".
- Apricot signal is reserved for things that need a human. Never decorative.
- No third-party ad surfaces exist in this system and none will be added.
