# HAFF deploy guide — Cloudflare Pages + Supabase

**Repo:** [github.com/gianaibodev/haff-leisure-club](https://github.com/gianaibodev/haff-leisure-club)  
**Goal:** Two services only — **Cloudflare Pages** (frontend) and **Supabase** (backend: Postgres + API).

| Service | Hosts |
|---------|--------|
| React SPA | **Cloudflare Pages** (`yourdomain.com`) |
| Postgres + API | **Supabase** (`*.supabase.co`) |

Replace `yourdomain.com` with your real domain (e.g. from Namecheap).

---

## Architecture

```
Browser / TV
    │
    ├─► yourdomain.com              → Cloudflare Pages (static build)
    │       VITE_API_URL points to Supabase Edge Functions
    │
    └─► xxx.supabase.co
            ├─► Postgres (Session, Users, Chat, …)
            └─► Edge Functions /functions/v1/haff-api/*  → Prisma → Postgres
```

**Do not put `DATABASE_URL` or service keys on Cloudflare Pages.**  
Only public `VITE_*` vars go on Pages. All secrets live in **Supabase Edge Function secrets**.

---

## ⚠️ Cloudflare: Pages vs Workers (read this first)

| You are on **Workers** (wrong) | You are on **Pages** (correct) |
|--------------------------------|----------------------------------|
| **Deploy command** / `npx wrangler deploy` | **Build output directory** = `dist/web` |
| “Ship something new” without Git | **Workers & Pages → Pages → Connect to Git** |

If you see wrangler deploy as the main step → go back and open **Pages**.

---

## Step 1 — Supabase (backend)

### 1.1 Create project

1. Sign up at [supabase.com](https://supabase.com)
2. **New project** → pick region close to your club (e.g. EU if Spain)
3. Save the **database password** — you need it once for connection strings

### 1.2 Connection strings

**Project Settings → Database → Connection string**

| Use | Pooler (port **6543**) | Direct (port **5432**) |
|-----|------------------------|-------------------------|
| App runtime | `DATABASE_URL` | — |
| Migrations / `prisma db push` | — | `DIRECT_URL` |

Copy both into a local `.env` (see `deploy/supabase.env.example`).

### 1.3 Apply schema

On your Mac (repo root):

```bash
cp deploy/supabase.env.example .env
# Fill DATABASE_URL and DIRECT_URL from Supabase dashboard

npm ci
npx prisma db push
```

### 1.4 Edge Function secrets

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link the project, then set secrets:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set \
  DATABASE_URL="postgresql://..." \
  DIRECT_URL="postgresql://..." \
  INITIAL_ADMIN_EMAIL="you@example.com" \
  FEEDBACK_HASH_SECRET="long-random-string" \
  FRONTEND_ORIGIN="https://yourdomain.com,https://www.yourdomain.com,https://haff-leisure-club.pages.dev" \
  ABLY_API_KEY="your-ably-key-if-using-push-sync"
```

Optional: `TURNSTILE_SECRET_KEY`, `COOKIE_DOMAIN` (only if you use a custom API domain on the same parent domain).

### 1.5 Deploy API (Edge Functions)

The Node API in `/api` deploys as a Supabase Edge Function bundle (see `supabase/functions/haff-api`).

```bash
supabase functions deploy haff-api --no-verify-jwt
```

Your API base URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/haff-api
```

Test:

```bash
curl -s "https://YOUR_PROJECT_REF.supabase.co/functions/v1/haff-api/health"
```

> **Note:** Until Edge Functions are fully wired, you can run the API locally with `DATABASE_URL` pointed at Supabase for development: `npm start` (see Local dev below).

### 1.6 Enable Realtime (optional, saves bandwidth)

**Database → Replication** → enable **`Session`** (and `ChatMessage` if using community chat).

Clients can subscribe to row changes instead of polling full JSON. Pair with `ABLY_API_KEY` or Supabase Realtime — see bandwidth notes in `docs/HAFF_PicklePulse_System_Overview.md` §13.

---

## Step 2 — Cloudflare Pages (frontend)

### 2.1 Connect GitHub

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Pages**
2. **Create application** → **Connect to Git**
3. Select **`gianaibodev/haff-leisure-club`**

### 2.2 Build settings

| Field | Value |
|-------|--------|
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `npm ci && npm run build:pages` |
| Build output directory | `dist/web` |
| Root directory | `/` |

### 2.3 Environment variables (Pages → Settings → Environment variables)

| Variable | Example | Notes |
|----------|---------|--------|
| `NODE_VERSION` | `22` | |
| `VITE_API_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/haff-api` | No trailing slash |
| `VITE_REALTIME_CLUB` | `true` | Push sync for session (needs `ABLY_API_KEY` on Supabase) |
| `VITE_REALTIME_CHAT` | `true` | Push sync for community chat |

**Never** add `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or other secrets here.

### 2.4 Deploy

**Save and Deploy**. Success URL:

```text
https://haff-leisure-club.pages.dev
```

### 2.5 Custom domain

After DNS (Step 3): **Pages → Custom domains** → add `yourdomain.com` and `www.yourdomain.com`.

---

## Step 3 — DNS (Namecheap + Cloudflare)

1. Add site at Cloudflare → point Namecheap nameservers to Cloudflare
2. **DNS → Records:**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| `CNAME` | `@` | `haff-leisure-club.pages.dev` | Proxied (orange) |
| `CNAME` | `www` | `haff-leisure-club.pages.dev` | Proxied (orange) |

No `api` A record needed — API stays on `*.supabase.co`.

Update Supabase secret `FRONTEND_ORIGIN` to include your custom domain, then redeploy the Edge Function if CORS changes.

---

## Step 4 — First login

1. Open `https://yourdomain.com/admin` (or `.pages.dev` URL)
2. Register with the email in `INITIAL_ADMIN_EMAIL` → becomes **admin**
3. Before go-live: set `SKIP_ADMIN_LOGIN = false` in `apps/web/src/lib/devFlags.ts` and redeploy Pages

---

## Cross-origin auth note

Pages (`yourdomain.com`) and API (`*.supabase.co`) are different origins. The app uses `credentials: "include"` and httpOnly cookies when API is same-origin (Vercel dev). On split deploy:

- Login responses must return a token the SPA stores and sends as `Authorization: Bearer …`, **or**
- Use **Supabase Auth** for sessions, **or**
- Add a Cloudflare **Worker route** on `yourdomain.com/api/*` that proxies to Supabase (same-origin cookies) — optional advanced setup

See `apps/web/src/lib/api.ts` — ensure `VITE_API_URL` is set before production traffic.

---

## Alternative: deploy frontend via GitHub Actions

1. Cloudflare → **API Tokens** (Edit Cloudflare Workers template)
2. GitHub repo → **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
3. **Variables:** `VITE_API_URL` = your Supabase function URL
4. Run **Actions → Deploy frontend to Cloudflare Pages**

---

## Updates later

| Piece | How |
|-------|-----|
| Frontend | Push to `main` → Pages rebuilds |
| Database schema | `npx prisma db push` locally with `DIRECT_URL` |
| API | `supabase functions deploy haff-api` |

---

## Local dev

**Terminal 1 — API (talks to Supabase Postgres):**

```bash
cp deploy/supabase.env.example .env
# DATABASE_URL + DIRECT_URL from Supabase dashboard
npm ci
npx prisma db push
npm start
```

**Terminal 2 — frontend:**

```bash
VITE_API_URL=http://localhost:3000 npm run dev:web
```

---

## Supabase free tier (watch these)

| Limit | Free tier | HAFF usage |
|-------|-----------|------------|
| Database size | 500 MB | Plenty for 50–100 members |
| Egress | 5 GB/mo | Keep `?ping=1` + Realtime; avoid full JSON polling |
| Edge Function invocations | 500K/mo | Fine with push sync + 60s ping fallback |
| Realtime messages | 2M/mo | Session + chat updates |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Stuck on Workers / wrangler | Use **Pages** tab |
| Pages build fails | `npm ci && npm run build:pages`, output `dist/web` |
| API CORS errors | Set `FRONTEND_ORIGIN` on Supabase secrets; include exact browser origin |
| Login works locally, not production | Cross-origin cookies — see auth note above |
| TV not syncing | Check API health URL; enable `VITE_REALTIME_CLUB` + `ABLY_API_KEY` |
| Prisma errors | Use pooler URL for runtime, direct URL for `db push` |

---

## Security checklist

- [ ] `SKIP_ADMIN_LOGIN = false` before go-live
- [ ] Strong DB password + `FEEDBACK_HASH_SECRET`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in Supabase secrets — never in Pages or git
- [ ] Rotate keys if they were ever committed

---

## Repo files reference

| File | Purpose |
|------|---------|
| `deploy/supabase.env.example` | Local + Edge Function env template |
| `apps/web/src/lib/api.ts` | Reads `VITE_API_URL` |
| `apps/web/public/_redirects` | SPA routes on Pages |
| `supabase/functions/haff-api/` | Supabase Edge Function API |
| `docs/SUPABASE_CLOUDFLARE_SETUP.md` | Extended reference |

**Legacy (not used in this plan):** `docker-compose.production.yml`, `scripts/oracle-bootstrap.sh`, `docs/ORACLE_CLOUDFLARE_SETUP.md`
