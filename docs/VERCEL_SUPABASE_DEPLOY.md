# HAFF — Vercel (static) + Supabase (all app data)

**Stack:** Vercel hosts the **React SPA only**. **Supabase** hosts Postgres, Realtime, and all normal app data reads/writes from the browser.

| Service | Role | What counts against free tier |
|---------|------|-------------------------------|
| **Vercel Hobby** | Static HTML/JS/CSS | Small asset transfer only — **not** live stack/chat/player JSON |
| **Supabase** | Postgres + Realtime + Storage | DB egress + realtime connections |

When `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set at build time, the app uses **direct Supabase access** (`VITE_USE_SUPABASE_DATA` defaults to on).

### What still uses Vercel `/api` (minimal)

| Route | Why |
|-------|-----|
| `/api/auth` | HttpOnly session cookies |
| `/api/community` POST/PATCH/DELETE | Auth + moderation |
| `/api/sync`, `/api/operations/events` | Server-validated player sync queue |
| `/api/feedback`, `/api/testimonials` | Admin moderation |

Everything else — **players, courts, live session, chat reads, realtime** — goes **direct to Supabase**.

---

## 1. GitHub

Repo: `https://github.com/gianaiboboyero/haffleisureclub`

```bash
git remote set-url origin https://github.com/gianaiboboyero/haffleisureclub.git
git push -u origin main
```

---

## 2. Vercel import

> **If your old Vercel team is blocked** (“fair use limits”), create a **new Vercel account** logged in with **GitHub `gianaiboboyero`**, then import the repo fresh. Copy env vars from the old project or from Supabase.

1. [vercel.com/new](https://vercel.com/new) → Import **`gianaiboboyero/haffleisureclub`**
2. Framework: **Vite** (or use existing `vercel.json`)
3. Build: `npm run build:web` → Output: `dist/web`
4. **Do not** set `VITE_API_URL` — same-origin `/api` on Vercel

### Required environment variables (Vercel → Settings → Environment Variables)

Copy from Supabase dashboard → **Project Settings → Database**:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Transaction pooler URI (port **6543**, `?pgbouncer=true`) |
| `DIRECT_URL` | Direct URI (port **5432**) |
| `INITIAL_ADMIN_EMAIL` | Your admin email |
| `FEEDBACK_HASH_SECRET` | Random string |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_REALTIME_CLUB` | `true` — Supabase Realtime for live stack |
| `VITE_REALTIME_CHAT` | `true` — Supabase Realtime for chat reads |

Optional: `VITE_USE_SUPABASE_DATA=false` to force legacy `/api` path (debug only).

Apply to **Production**, **Preview**, and **Development**.

### Deploy

Push to `main` or click **Deploy** in Vercel dashboard.

---

## 3. Supabase direct data (built into the app)

| Mechanism | Saves |
|-----------|--------|
| Browser → Supabase for players/courts/session | **No Vercel Fast Origin Transfer** for live data |
| Supabase Realtime on `Session`, `Player`, `ChatMessage` | Push updates; rare poll fallback |
| Tiny live session (IDs + courts + matches in `settings`) | Small Supabase egress |
| Compact player roster cache (1h TTL) | Fewer repeat player fetches |
| Community **reads** from Supabase; writes stay on `/api/auth` | Auth stays server-side |
| `scripts/supabase-rls.sql` | RLS + Realtime publication |

Apply RLS after schema push:

```bash
npm run db:rls
npm run db:seed-courts
npm run db:backup-players
```

Import players safely (upsert by id):

```bash
npm run db:import-players data/players-backup.json
```

---

## 4. Supabase setup

```bash
cp deploy/supabase.env.example .env
# Fill DATABASE_URL + DIRECT_URL from Supabase dashboard
npx prisma db push
```

Enable **Replication** on `Session` (and `ChatMessage` if using community) for future Realtime.

---

## 5. After deploy

1. Open `https://your-app.vercel.app/admin`
2. Register with `INITIAL_ADMIN_EMAIL` → admin
3. Set `SKIP_ADMIN_LOGIN = false` in `apps/web/src/lib/devFlags.ts` before public launch

---

## 6. Monitoring

**Vercel:** Settings → Usage → watch **Fast Origin Transfer** and **Function Invocations**

**Supabase:** Settings → Usage → **Egress** and **Database size**

If Transfer climbs during idle nights, confirm Ably is set and TV isn’t on an old cached bundle (hard refresh TV browser).

---

## Local dev

```bash
cp deploy/supabase.env.example .env
npx prisma db push
npm run dev:full   # Vercel dev: web + /api together
```
