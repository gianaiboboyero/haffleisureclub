# HAFF PicklePulse — Cloudflare Pages + Supabase

> **Step-by-step UI instructions:** [DEPLOY_QUICKSTART.md](./DEPLOY_QUICKSTART.md)

Two-service production stack (~$0/month at club scale):

| Piece | Host | Cost |
|-------|------|------|
| React SPA | Cloudflare Pages | Free (unlimited static bandwidth) |
| PostgreSQL | Supabase | Free tier (500 MB) |
| HTTP API | Supabase Edge Functions | Free tier (500K invocations/mo) |
| Realtime (optional) | Supabase Realtime + Ably | Free tiers |

**Example URLs**

| URL | Points to |
|-----|-----------|
| `https://haffcadiz.com` | Cloudflare Pages |
| `https://abcdefgh.supabase.co/functions/v1/haff-api` | Supabase Edge Function (API) |
| Postgres | `pooler.supabase.com` (not public) |

---

## Architecture

```
[Browser / TV / Admin tablet]
      │
      ├─► haffcadiz.com ──────────► Cloudflare Pages (Vite build)
      │         fetch(VITE_API_URL + /api/...)
      │
      └─► xxx.supabase.co
                │
                ├─► Edge Functions (haff-api) ──► Prisma ──► Postgres
                ├─► Realtime (Session, ChatMessage) — optional push
                └─► Storage — avatars if migrated later
```

### Why not Vercel or Oracle?

| Previous option | Issue |
|-----------------|-------|
| Vercel Hobby | Fast Origin Transfer capped at 10 GB; polling maxed the project |
| Oracle VM + self-hosted Postgres | Extra ops (VM, Caddy, backups); you asked for Supabase-only backend |

### Why not Postgres on the VM?

Supabase gives you managed Postgres, backups, pooler, dashboard, and Realtime in one project — one backend to operate.

---

## Part 1 — Supabase project

### 1.1 Create & connect

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Region: closest to Cádiz / users
3. Copy **Project URL**, **anon key**, **service role key** (Settings → API)
4. Copy **Database** connection strings (Settings → Database)

Use **Transaction pooler** (6543) for `DATABASE_URL` and **Session/direct** (5432) for `DIRECT_URL`.

### 1.2 Schema

```bash
cp deploy/supabase.env.example .env
npx prisma db push
```

Tables include `Session`, `User`, `Player`, `Match`, `ChatMessage`, etc. (see `prisma/schema.prisma`).

### 1.3 Edge Function secrets

```bash
supabase secrets set DATABASE_URL="..." DIRECT_URL="..." \
  INITIAL_ADMIN_EMAIL="admin@example.com" \
  FRONTEND_ORIGIN="https://haffcadiz.com,https://www.haffcadiz.com" \
  FEEDBACK_HASH_SECRET="..." \
  ABLY_API_KEY="..."
```

### 1.4 Deploy function

```bash
supabase functions deploy haff-api --no-verify-jwt
```

`--no-verify-jwt` allows the app’s existing cookie/JWT auth middleware to run inside the function (same as Vercel). Tighten with Supabase JWT verification later if you migrate to Supabase Auth.

### 1.5 Realtime (recommended)

**Database → Publications → supabase_realtime** → add tables:

- `Session` — TV/admin sync when row `updatedAt` changes
- `ChatMessage` — community chat without 10s polling

Enable **Replication** for those tables. Frontend can subscribe with `@supabase/supabase-js` (future enhancement) or keep Ably push + lightweight ping.

---

## Part 2 — Cloudflare Pages

See [DEPLOY_QUICKSTART.md § Step 2](./DEPLOY_QUICKSTART.md#step-2--cloudflare-pages-frontend).

Key env:

```env
VITE_API_URL=https://YOUR_REF.supabase.co/functions/v1/haff-api
VITE_REALTIME_CLUB=true
NODE_VERSION=22
```

SPA routing: `apps/web/public/_redirects`

---

## Part 3 — DNS

Only Pages records — no API subdomain required:

| Type | Name | Target |
|------|------|--------|
| CNAME | `@` | `haff-leisure-club.pages.dev` |
| CNAME | `www` | `haff-leisure-club.pages.dev` |

---

## Part 4 — Bandwidth & free tier safety

Changes in the codebase to protect **both** Cloudflare and Supabase egress:

| Mechanism | Effect |
|-----------|--------|
| `GET /api/club-state?ping=1` | DB reads `updatedAt` only; ~80 byte response |
| Ably `session.updated` push | Full fetch only on change |
| POST returns `{ sessionId, updatedAt }` | No double full JSON on writes |
| `view=tv` GET trim | TV skips kudos/reviews/reservations |
| 60s ping fallback | Down from 2–15s full polling |

**Supabase egress:** each unchanged ping ≈ 80 bytes over the wire vs 50–200 KB full session blob.

---

## Part 5 — Local development

```bash
# .env with Supabase DATABASE_URL + DIRECT_URL
npm start                    # API on :3000 → Supabase Postgres
VITE_API_URL=http://localhost:3000 npm run dev:web
```

Or `npm run dev:full` with Vercel dev if you still use `/api` locally via Vercel CLI.

---

## Part 6 — Maintenance

**Schema change:**

```bash
npx prisma db push
```

**Redeploy API:**

```bash
supabase functions deploy haff-api
```

**Redeploy frontend:** git push → Pages auto-build.

**Backup:** Supabase dashboard → **Database → Backups** (daily on free tier, limited retention).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS | `FRONTEND_ORIGIN` must match browser origin exactly |
| 401 on API | Auth cookies don’t cross `supabase.co` — use bearer token or proxy |
| Pooler errors in migrations | Use `DIRECT_URL` for `prisma db push` only |
| Edge Function timeout | Default 60s; keep handlers lean; use ping + push |
| Realtime not firing | Table added to `supabase_realtime` publication? |

---

## Security checklist

- [ ] `SKIP_ADMIN_LOGIN = false` in production
- [ ] Service role key only in Supabase secrets
- [ ] RLS policies if exposing Supabase client to browser (future)
- [ ] Rotate DB password if ever leaked

---

## Related files

| File | Purpose |
|------|---------|
| `deploy/supabase.env.example` | Env template |
| `apps/web/src/lib/api.ts` | API base URL |
| `api/*.ts` | Handlers (deployed via Edge Function) |
| `prisma/schema.prisma` | Database schema |

**Deprecated for this plan:** `docker-compose.production.yml`, `deploy/env.production.example` (Oracle), `docs/ORACLE_CLOUDFLARE_SETUP.md`
