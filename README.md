# HAFF Leisure Club — Court Management System

Court rotation and live display app for HAFF Leisure Club, Cadiz City.

Handles player check-in, queue management, court assignments, and a TV scoreboard for open-play sessions.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Zustand (state)
- Framer Motion (animations)
- Supabase (database + realtime)
- Prisma (schema / migrations)
- Vercel (hosting)

## Running locally

```bash
npm install
npm run dev:web
```

App runs at `http://localhost:5173`.

For phones or tablets on the same Wi-Fi, run:

```bash
npm run network
```

Then open the Network URL Vite prints, e.g. `http://192.168.x.x:5173`.

## Environment

Copy `deploy/supabase.env.example` to `.env.local` and fill in your Supabase project values. The file lists every required variable with comments.

Never commit `.env` or `.env.local`.

## Screens

| Route | Who uses it |
|---|---|
| `/home` | Landing page |
| `/admin` | Staff — full session control |
| `/player` | Members — queue status and wait time |
| `/tv` | Venue TV — live court board |
| `/finance` | Admin — revenue ledger |
| `/calendar` | Court reservations |

## How it works

1. Admin checks players in at the start of the session.
2. Players are arranged into stacks of four in the queue.
3. Admin assigns or reserves courts from the stack.
4. Players play. When the game ends, admin taps **Finish**.
5. The court becomes available and the next stack moves up.
6. The TV display updates in real time via Supabase Realtime.

## Dev commands

```bash
npm run dev:web       # start frontend
npm run build:web     # production build
npm run typecheck     # type check
```

## Deployment

Push to `main` — Vercel auto-deploys. Set all environment variables in the Vercel dashboard under Project Settings → Environment Variables.
