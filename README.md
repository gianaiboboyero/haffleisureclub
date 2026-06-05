# HAFF PicklePulse

Offline-first pickleball game-day system for HAFF Leisure Club.

The visual direction is intentionally HAFF-first: deep forest green, warm ivory, brass accents, editorial type, and a monogram-style club mark. The app should feel like a premium leisure club operating desk and live event board, not a generic sports admin panel.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui-style primitives
- Dexie.js for IndexedDB
- Zustand for app state
- Framer Motion for motion
- Howler.js for sound feedback
- vite-plugin-pwa for installable/offline behavior
- Socket.IO-ready sync direction
- NestJS + PostgreSQL + Prisma backend foundation

## Local Start

```bash
npm install
npm run dev:web
```

Open `http://localhost:5173`.

For phones, tablets, or TV browsers on the same Wi-Fi:

```bash
npm run network
```

Then open the Network URL printed by Vite, for example `http://192.168.x.x:5173`.

## Logo Asset

The app now uses the official raster logo file instead of a recreated code logo.

The exact logo image is used from:

```txt
apps/web/public/haff-logo.jpg
```

The app will load it from:

```txt
/haff-logo.jpg
```

The current MVP shell includes admin control, player check-in, open-play court assignment, stack-based court reservation, player wait-time view, local persistence, sync queue writes, simple game/day counters, sound feedback, and TV display mode.

## Super Simple Explanation

Think of HAFF PicklePulse as four simple screens:

1. `Admin`: the staff desk. Admins check people in, hold/reserve courts, and send players to courts.
2. `Player`: the player login view. A player chooses their name and sees whether they are playing now, next, or about how many minutes they may wait.
3. `TV Display`: the monitor. It should be readable from far away and only show who is playing now plus who is next.

The Wi-Fi/status chip in the top-right exists because the app is offline-first. It tells staff whether the browser is online/offline and whether there are local changes waiting to sync. It is not a decoration and it is not a manual connection switch.

## Accessibility Rule

Design changes should be checked against WCAG contrast before shipping.

Current main color pairs checked:

- Ivory on forest: `10.45`, passes AA
- Forest on ivory: `10.45`, passes AA
- Brass on forest: `4.55`, passes AA
- Linen on forest: `9.21`, passes AA
- Clay on ivory: `4.87`, passes AA
- Muted forest on ivory: `4.65`, passes AA
- Ivory on dark panel: `8.90`, passes AA

## Why There Is No Scorekeeping In The Main Flow

HAFF has many courts, so asking someone to enter scores for every court would slow the operation down.

For this version, the system does not need a scorekeeper screen. The main action is:

- Admin assigns a stack to a court
- Admin can reserve a court for a specific stack
- Players play
- When the court is done, admin taps `Finish`
- The system marks the court available again
- The system counts games played and days played

Detailed scores can be added later for tournaments or special events, but wins/losses should not be part of everyday open play.

## What Is Necessary?

### Necessary for MVP

- Admin check-in
- Court status: available, in use, reserved, maintenance
- Reserve by stack, with the actual player names displayed
- Drag-and-drop stack builder for manually arranging players
- Player parking mode for stepping away temporarily
- Open-play assignment
- Player wait estimate
- Adjustable default open-play minutes
- Court countdown with negative overtime minutes
- Finish court without score entry
- TV now-playing / next-up display
- Offline local save

### Useful but later

- Full player accounts with password/login
- QR check-in
- Optional scorekeeping for tournaments, without open-play win tracking
- Advanced pickleball server tracking
- Round robin and King/Queen modes
- Conflict resolution between devices
- Reports and exports
- Achievements and sound customization

### Not necessary for this system

- Payments
- Membership billing
- Booking marketplace
- Coach marketplace
- Complex social features

## Current Screens

- `Admin`: session overview, check-in lounge, court cards, court reservation, open-play assignment, admin role summary, player detail summary, top player card
- `Player`: player login/picker, check-in status, approximate wait time, simple stats
- `TV Display`: bold dark HAFF green live board with court assignments and next-up stacks only

## Design Component Direction

The interface should move away from outlined admin cards and toward richer open-source-inspired product components:

- Bento status blocks inspired by modern shadcn block libraries
- Floating mobile dock navigation inspired by animated React/Tailwind component libraries
- Tonal glass panels instead of bordered cards
- Live ticker banner for next-up instructions and announcements
- Cinematic TV court tiles with depth, soft glow, and strong typographic hierarchy
- Command rail for session actions and system readiness

References worth borrowing from as the UI grows:

- shadcn/ui: https://ui.shadcn.com
- shadcn blocks: https://ui.shadcn.com/blocks
- Aceternity UI: https://ui.aceternity.com
- Magic UI: https://magicui.design
- Origin UI: https://originui.com
- Tremor dashboards: https://www.tremor.so
- React Bits: https://www.reactbits.dev

## Admin Details

The admin side is the game-day control center.

### Owner

Can manage the whole club system:

- Players, courts, sessions, matches, announcements, settings, reports, display mode
- Offline sync status and conflict decisions
- Role assignment and future user permissions
- Club branding, sound settings, and event defaults

### Admin

Runs daily operations:

- Check players in and out
- Reserve or clear courts
- Generate open-play matches
- Assign and clear courts
- Start, pause, complete, reopen, or correct matches
- Publish display announcements
- Review attendance, court status, stack order, and participation
- Export player/session data once reports are implemented

### Scorekeeper

Focused match role:

- Open assigned match
- Update Team A / Team B score
- Undo or correct score entries
- Finish court and move rotation forward
- Keep working offline when the network is unstable

## User / Player Details

Players should feel seen on the display and rewarded for participation.

### Player Profile Data

- Display name
- Full name or nickname
- Skill level: Beginner, Intermediate, Advanced, Competitive
- Tags: Guest, Regular, VIP, Needs Partner, Late Arrival
- Optional contact details
- Notes for admins

### Player Stats

- Total games played
- Total days played
- Current rank/level
- Games played
- Last played date

### Player Experience

- Quick check-in by admin search
- Court assignment visibility
- Score and result visibility
- Wait-time visibility
- TV next-up visibility
- Participation rewards through games played, days played, and friendly rank labels

## Player Login Direction

The current MVP uses a player picker so the flow is easy to test.

Later, player login can become:

- Phone number login
- QR code from the front desk
- Email magic link
- PIN code for regular players

The player view should answer only the most important questions:

- Am I checked in?
- Am I playing now?
- Am I next?
- About how many minutes until I play?
- How many games and days have I played?

## Parking Mode

Parking mode is a pause button for players.

If a player needs to step away, they can tap `Park Me For Now` from the Player view. While parked:

- They stay checked in
- They are removed from stack order
- They are skipped by court assignment
- They are skipped by court reservation
- Their player status shows as `Parked`

When ready, they tap `Resume Play` and the system adds them back into the waiting rotation.

## Mental Health Rule

Open play should not rank people by wins.

For HAFF, the default system should avoid:

- Most wins
- Win/loss records
- Win rate
- Win streaks
- Public competitive leaderboards

The safer default is to celebrate:

- Showing up
- Playing regularly
- Getting assigned clearly
- Moving through the queue fairly
- Friendly skill/rank grouping
- Court flow and wait-time transparency

## Stack Builder Rule

Admins can manually drag players into Stack 1, Stack 2, Stack 3, and so on.

Each stack is normally four players. The stack order controls:

- Who appears next on the TV display
- Who gets reserved when admin taps `Reserve Stack`
- Who gets assigned when admin taps `Assign Courts`
- The approximate wait shown in the Player view

This is useful when the organizer wants to balance players socially, keep friends together, split certain players, or prioritize someone manually.

## TV Display Rule

The TV display is not a dashboard.

Do not overload it with leaderboards, tiny stats, or script typography. It should use bold sans-serif text and show:

- Court name
- Players currently playing
- Rank badges for players
- Minutes left or negative overtime
- Reserved/available status
- Reserved stack player names
- Next-up player stacks

The goal is readability from across the venue.

## Open Play Time Rule

The system uses a default open-play duration. The current default is `12 minutes`.

Admins can adjust it up or down from the admin screen. Each active court counts down from that value. If a court goes past the default time, the timer becomes negative, for example:

- `Time Left 3 min`
- `Time Left 1 min`
- `Overtime -2 min`

This keeps the club moving without forcing score entry.

## Player Rank Animation

Players can have these rank labels:

- Newbie
- Beginner
- Novice
- Low Intermediate
- Intermediate
- Pro

The TV display can animate rank badges differently so people can quickly notice the level of a stack. The animation should stay subtle enough for a premium HAFF look.

## Offline Behavior

Current frontend behavior:

- Loads seeded club data into IndexedDB
- Persists players, courts, matches, and sync queue locally
- Writes check-ins, score updates, match creation, and match completion into the sync queue
- Lets the UI update instantly before server sync exists

Backend sync is scaffolded through NestJS and Prisma, but database-backed sync is still the next implementation step.

## Next Build Priorities

1. Real admin/player routes instead of single-screen mode switching
2. Player CRUD, court CRUD, and session CRUD forms
3. CSV import/export
4. Prisma-backed NestJS API services
5. Socket.IO live display updates
6. Conflict resolution screen
7. Full PWA install icons and branded assets
