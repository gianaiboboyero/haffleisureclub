# HAFF PicklePulse Handoff

## Product Summary

HAFF PicklePulse is an offline-first open-play court rotation system for HAFF Leisure Club.

It is not a scoreboard-first product. It is a court flow, queue, player check-in, and TV display system.

The main idea:

- Admin checks players in.
- Admin arranges players into stacks of four.
- Admin assigns or reserves courts.
- Players can see whether they are playing soon.
- Players can park themselves if they are stepping away.
- TV display shows current courts and next-up stacks.

## Current Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui-style local primitives
- Zustand
- Dexie.js / IndexedDB
- Framer Motion for small page/toast transitions
- Howler.js for short local sound feedback
- vite-plugin-pwa
- Socket.IO dependencies installed, not fully wired yet
- NestJS API skeleton
- PostgreSQL + Prisma schema foundation

## Commands

Install:

```bash
npm install
```

Run locally:

```bash
npm run dev:web
```

Run for same-Wi-Fi phones/tablets/TV browsers:

```bash
npm run network
```

Build:

```bash
npm run build:web
```

Typecheck:

```bash
npm run typecheck
```

## Important Asset

The official logo is saved here:

```txt
apps/web/public/haff-logo.jpg
```

The app loads it from:

```txt
/haff-logo.jpg
```

If missing, the UI intentionally shows `Logo missing`.

## Main Screens

### Admin

Purpose: operate open play.

Admin can:

- Check in players
- View checked-in count
- View court status
- Drag players into stacks
- Reserve a court for the next stack
- Start a reserved stack
- Assign courts automatically from stack order
- Finish courts when games are done
- Adjust default open-play minutes

### Player

Purpose: let a player understand their own play status.

Player can:

- Pick their name
- Check in
- See if they are playing now
- See if they are next
- See approximate wait time
- Park themselves if stepping away
- Resume play when ready

### TV Display

Purpose: big readable venue monitor.

TV display shows:

- Court names
- Current players playing
- Reserved stack names
- Next-up stacks
- Court timer
- Overtime as negative minutes

TV display intentionally does not show:

- Leaderboards
- Wins
- Win rate
- Win streaks
- Decorative script fonts

## Core Product Decisions

### No Win Tracking For Open Play

Open play should not track or display:

- Most wins
- Win/loss records
- Win rate
- Win streaks
- Public competitive leaderboards

Reason: it can affect player comfort and mental health. The product should reward participation and clarity, not pressure.

### No Scorekeeping In Main Flow

HAFF has many courts. Entering scores for every court creates work.

Instead:

- Admin starts/assigns a court.
- Players play.
- Admin taps `Finish`.
- System logs games/days played and frees the court.

Scorekeeping can be added later only for tournaments or special events.

### Parking Mode

Parking mode is a player pause.

When parked:

- Player stays checked in.
- Player is skipped by stack order.
- Player is skipped by court assignment.
- Player is skipped by reservation.
- Player can resume anytime.

### Stack Builder

Stacks are the main control unit.

- Each stack is normally four players.
- Admin can drag players between stacks.
- Stack order controls assignment, reservation, TV next-up, and player wait estimates.

## Data Model Notes

Current frontend player fields include:

- `id`
- `displayName`
- `skillLevel`
- `rating`
- `tags`
- `checkedIn`
- `parked`
- `totalGamesPlayed`
- `totalDaysPlayed`
- `lastPlayedDate`

Court fields include:

- `id`
- `name`
- `number`
- `status`
- `currentMatchId`
- `reservedFor`
- `reservedPlayerIds`

Court statuses:

- `Available`
- `InUse`
- `Paused`
- `Maintenance`
- `Reserved`

## Rank Labels

Ranks are not HAFF brand colors. They use independent utility pastel colors.

Ranks:

- Newbie
- Beginner
- Novice
- Low Intermediate
- Intermediate
- Pro

Rank pills were made smaller and use normal kerning/title case. Avoid spaced text like `P R O`.

## Visual Direction

Current direction:

- Soft pastel earth palette
- Deep eucalyptus base
- Warm stone panels
- No gradients
- SF/system sans for operational UI
- Playfair Display only for admin/player headings
- TV display uses bold sans only
- No looping/breathing animation

Motion rule:

- No breathing/pulsing loops.
- No moving ticker.
- Only brief, functional transitions are okay.

## Accessibility / WCAG

Main color contrast checked:

- Ivory on forest: `10.45`
- Forest on ivory: `10.45`
- Brass on forest: `4.55`
- Linen on forest: `9.21`
- Clay on ivory: `4.87`
- Muted forest on ivory: `4.65`
- Ivory on dark panel: `8.90`

Keep checking WCAG when colors change.

## Offline-First Behavior

Current frontend behavior:

- Uses Dexie / IndexedDB
- Seeds demo players and courts locally
- Saves players, courts, matches, and sync queue locally
- Shows online/offline status
- Shows pending local changes
- Queue/status changes are stored locally first

The top-right Wi-Fi/status chip exists to show:

- Browser online/offline state
- Whether local changes are pending sync

It is not a manual Wi-Fi toggle.

## Backend Status

NestJS API skeleton exists:

- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/players.controller.ts`
- `apps/api/src/sync.controller.ts`

Prisma schema exists:

- `prisma/schema.prisma`

Backend persistence and real sync are not fully implemented yet.

## Current Verification

Latest checks passing:

```bash
npm run typecheck
npm run build:web
```

## Next Recommended Work

1. Keep the actual HAFF logo file at `apps/web/public/haff-logo.jpg`.
2. Split the single-screen mode switch into real routes.
3. Add admin player CRUD.
4. Add court CRUD.
5. Add session creation/editing.
6. Wire Socket.IO for live TV display updates.
7. Implement real backend sync with Prisma.
8. Add QR or phone-based player login.
9. Add backup/export/import for offline safety.
10. Do visual QA on TV and mobile widths.
