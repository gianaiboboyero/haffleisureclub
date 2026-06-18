# HAFF — Vercel + Supabase (free tier safe)

**Stack:** Vercel hosts the React app **and** `/api` serverless routes. **Supabase** hosts Postgres only (no API egress from Supabase to browsers).

| Service | Role | Free tier risk |
|---------|------|----------------|
| **Vercel Hobby** | SPA + `/api/*` | Fast Origin Transfer (10 GB/mo) — **polling is the killer** |
| **Supabase** | PostgreSQL | DB egress (5 GB/mo) — **tiny pings vs full JSON reads** |

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

**Recommended (cuts Vercel egress ~90%):**

| Variable | Value |
|----------|--------|
| `ABLY_API_KEY` | From [ably.com](https://ably.com) free tier — push sync |

Optional: `TURNSTILE_SECRET_KEY`

Apply to **Production**, **Preview**, and **Development**.

### Deploy

Push to `main` or click **Deploy** in Vercel dashboard.

---

## 3. Egress protections (already in code)

| Mechanism | Saves |
|-----------|--------|
| `GET /api/club-state?ping=1` | ~80 bytes vs 50–200 KB when idle |
| Ably `session.updated` push | Full fetch only on change |
| POST returns `{ sessionId, updatedAt }` only | Half write egress |
| `view=tv` trimmed GET | Smaller TV payloads |
| 60s ping fallback + hidden-tab skip | Fewer invocations |
| No duplicate TV poll timer | One poll path |

**Without `ABLY_API_KEY`:** still safe-ish with ping-only, but enable Ably for game nights.

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
