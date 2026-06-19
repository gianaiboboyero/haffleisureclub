# HAFF deploy guide — Vercel + Supabase

**Repo:** [github.com/gianaiboboyero/haffleisureclub](https://github.com/gianaiboboyero/haffleisureclub)

| Service | Hosts |
|---------|--------|
| React SPA + `/api` routes | **Vercel** |
| Postgres + Realtime + Storage | **Supabase** |

Full step-by-step: **[VERCEL_SUPABASE_DEPLOY.md](./VERCEL_SUPABASE_DEPLOY.md)**

## Quick deploy

1. Push to `main` on GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Build: `npm run build:web` → output `dist/web` (already in `vercel.json`).
4. Add env vars from Supabase (see `deploy/supabase.env.example`).
5. Deploy — Vercel builds on every push to `main`.

## Local build check

```bash
npm ci && npm run build:web
```

Output: `dist/web`
