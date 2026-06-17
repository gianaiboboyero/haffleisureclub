# 15-minute deploy checklist

Everything below that needs **your** Oracle / Cloudflare login cannot be done from Cursor alone.
After you complete the two account steps, GitHub Actions deploys the frontend automatically.

---

## Already done in the repo

- Production Docker stack (`docker-compose.production.yml`) — Postgres + API + Caddy
- Cloudflare Pages build (`npm run build:pages` → `dist/web`)
- GitHub Action: `.github/workflows/cloudflare-pages.yml`
- Setup guide: `docs/ORACLE_CLOUDFLARE_SETUP.md`

---

## Step A — GitHub secrets (5 min)

1. Cloudflare → **My Profile → API Tokens → Create Token**
   - Use template **Edit Cloudflare Workers** (includes Pages)
2. Copy **Account ID** from Cloudflare dashboard (right sidebar on any zone)
3. GitHub → `gianaibodev/haff-leisure-club` → **Settings → Secrets and variables → Actions**

| Name | Type | Value |
|------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Secret | token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | account ID |

4. **Variables** tab → add:

| Name | Value (update when API is live) |
|------|----------------------------------|
| `VITE_API_URL` | `https://api.YOURDOMAIN.com` |

5. Push to `main` or run **Actions → Deploy frontend to Cloudflare Pages → Run workflow**

---

## Step B — Oracle VM (15–20 min, one time)

1. [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) → create **Ampere A1** Ubuntu VM with your SSH key
2. Open ports **22, 80, 443** in Oracle **Security List**
3. SSH in and run:

```bash
git clone https://github.com/gianaibodev/haff-leisure-club.git /opt/haff-picklepulse
cd /opt/haff-picklepulse
cp deploy/env.production.example .env
nano .env   # set API_DOMAIN, FRONTEND_ORIGIN, COOKIE_DOMAIN, POSTGRES_PASSWORD
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec -T app npx prisma db push
curl -s http://localhost/health || curl -s http://127.0.0.1:3000/health
```

---

## Step C — DNS on Cloudflare (5 min)

Add your domain to Cloudflare, then:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| A | `api` | Oracle VM public IP | **DNS only** (grey) |
| CNAME | `@` | `haff-leisure-club.pages.dev` | Proxied |
| CNAME | `www` | `haff-leisure-club.pages.dev` | Proxied |

Pages → project **haff-leisure-club** → Custom domains → add your domain.

---

## Step D — Verify

```bash
curl https://api.YOURDOMAIN.com/health
# → {"ok":true,"apiOnly":true}
```

Open `https://YOURDOMAIN.com/admin` and log in with `INITIAL_ADMIN_EMAIL`.

Set `SKIP_ADMIN_LOGIN = false` in `apps/web/src/lib/devFlags.ts` before real users use the app.
