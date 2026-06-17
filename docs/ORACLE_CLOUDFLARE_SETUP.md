# HAFF PicklePulse — Oracle Free VM + Cloudflare Pages + Postgres

Deploy the **frontend free on Cloudflare Pages** and the **API + database on an Oracle Cloud Always Free VM** (~$0/month if you stay within free limits).

| Piece | Host | Cost |
|-------|------|------|
| React SPA | Cloudflare Pages | Free (generous bandwidth) |
| Node API | Oracle VM (Docker) | Free tier |
| PostgreSQL | Same VM (Docker) | Included |
| HTTPS API | Caddy on VM | Free (Let's Encrypt) |

**Example domains**

| URL | Points to |
|-----|-----------|
| `https://haffcadiz.com` | Cloudflare Pages |
| `https://api.haffcadiz.com` | Oracle VM (Caddy → app) |

Replace `haffcadiz.com` with your Namecheap domain everywhere below.

---

## Architecture

```
[Browser / TV]
      │
      ├─► Cloudflare Pages ── static JS/CSS (VITE_API_URL → api subdomain)
      │
      └─► api.haffcadiz.com ──► Oracle VM :443 ──► Caddy ──► Node API :3000
                                                    └──► Postgres :5432
```

Cookies use `COOKIE_DOMAIN=.haffcadiz.com` so login works across `haffcadiz.com` and `api.haffcadiz.com`.

---

## Part 1 — Oracle Cloud (free VM)

### 1.1 Create account & VM

1. Sign up at [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/)
2. **Compute → Instances → Create instance**
3. Recommended:

| Setting | Value |
|---------|--------|
| Name | `haff-api` |
| Image | **Ubuntu 22.04** or **24.04** |
| Shape | **Ampere A1** (ARM) — Always Free, pick **1 OCPU / 6 GB RAM** if available |
| Boot volume | 50 GB (free allowance) |
| Networking | Assign **public IPv4** |
| SSH keys | Paste your Mac public key (`cat ~/.ssh/id_ed25519.pub`) |

4. Note the **public IP** (e.g. `150.x.x.x`).

### 1.2 Open ports (Oracle + OS)

**Oracle Cloud Console → Networking → Virtual cloud networks → your VCN → Security Lists → Ingress:**

| Source | Protocol | Port |
|--------|----------|------|
| 0.0.0.0/0 | TCP | 22 |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

**On the VM** (bootstrap script does this too):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 1.3 Deploy API + Postgres

SSH in:

```bash
ssh ubuntu@YOUR_ORACLE_IP
```

Clone your repo (or upload via `git clone`):

```bash
sudo mkdir -p /opt/haff-picklepulse
sudo chown "$USER":"$USER" /opt/haff-picklepulse
git clone https://github.com/YOUR_USER/haff-picklepulse.git /opt/haff-picklepulse
cd /opt/haff-picklepulse
```

Configure environment:

```bash
cp deploy/env.production.example .env
nano .env
```

Set at minimum:

```env
API_DOMAIN=api.haffcadiz.com
FRONTEND_ORIGIN=https://haffcadiz.com,https://www.haffcadiz.com
COOKIE_DOMAIN=.haffcadiz.com
POSTGRES_PASSWORD=your-long-random-password
INITIAL_ADMIN_EMAIL=you@example.com
```

Start stack:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec -T app npx prisma db push
```

Check health (after DNS in Part 2):

```bash
curl -s https://api.haffcadiz.com/health
# {"ok":true,"apiOnly":true}
```

**Or use the bootstrap script:**

```bash
REPO_URL=https://github.com/YOUR_USER/haff-picklepulse.git sudo bash scripts/oracle-bootstrap.sh
# Edit .env, then run compose commands above
```

---

## Part 2 — DNS (Namecheap + Cloudflare)

### 2.1 Move DNS to Cloudflare (recommended)

1. Add site at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Cloudflare gives you two nameservers — set those at **Namecheap → Domain → Nameservers**
3. Wait for activation (usually minutes to a few hours)

### 2.2 Records

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| `A` | `api` | Oracle VM public IP | **DNS only** (grey cloud) |
| `CNAME` | `@` | `your-project.pages.dev` | Proxied (orange) |
| `CNAME` | `www` | `your-project.pages.dev` | Proxied |

Use **DNS only** for `api` so Caddy on the VM can issue Let's Encrypt certificates directly.

---

## Part 3 — Cloudflare Pages (frontend)

### 3.1 Connect GitHub

1. [Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git](https://dash.cloudflare.com/)
2. Select this repository
3. **Build settings:**

| Setting | Value |
|---------|--------|
| Framework preset | None |
| Build command | `npm ci && npm run build:pages` |
| Build output directory | `dist/web` |
| Root directory | `/` (repo root) |
| Node version | `22` (set in Environment variables or use `.node-version` if added) |

### 3.2 Environment variables (Pages → Settings → Environment variables)

**Production:**

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.haffcadiz.com` |
| `NODE_VERSION` | `22` |

No trailing slash on `VITE_API_URL`.

### 3.3 Custom domain

Pages → **Custom domains** → add `haffcadiz.com` and `www.haffcadiz.com`.

SPA routing is handled by `apps/web/public/_redirects` (copied into the build).

### 3.4 Deploy

Push to `main` — Pages builds automatically. First deploy may take 3–5 minutes.

---

## Part 4 — First admin login

1. Open `https://haffcadiz.com/admin`
2. Register / log in with the email matching `INITIAL_ADMIN_EMAIL` in `.env` — that account becomes **ADMIN**
3. For local dev bypass, see `apps/web/src/lib/devFlags.ts` (`SKIP_ADMIN_LOGIN`) — **set to `false` before production**

---

## Part 5 — Local development (split stack)

**Terminal 1 — API + Postgres on VM or locally:**

```bash
cp deploy/env.production.example .env
# For local only:
# FRONTEND_ORIGIN=http://localhost:5173
# API_ONLY=true
docker compose -f docker-compose.production.yml up --build
```

**Terminal 2 — Vite frontend:**

```bash
VITE_API_URL=http://localhost:3000 npm run dev:web
```

Or without `VITE_API_URL`, Vite proxies `/api` → `http://127.0.0.1:3000` when the API runs locally.

---

## Part 6 — Updates & maintenance

**Redeploy API on Oracle:**

```bash
cd /opt/haff-picklepulse
git pull
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec -T app npx prisma db push
```

**Redeploy frontend:** push to GitHub — Cloudflare Pages rebuilds automatically.

**Logs:**

```bash
docker compose -f docker-compose.production.yml logs -f app
docker compose -f docker-compose.production.yml logs -f caddy
```

**Backup Postgres:**

```bash
docker compose -f docker-compose.production.yml exec postgres \
  pg_dump -U haff haff > haff-backup-$(date +%F).sql
```

---

## Oracle Always Free limits (watch these)

| Resource | Free allowance |
|----------|----------------|
| Ampere A1 | 4 OCPUs / 24 GB RAM total across VMs |
| Block storage | 200 GB |
| Egress | 10 TB/month (region-dependent) |

HAFF with 50–100 members + one TV polling every 15s is well within this if you keep using conditional `?since=` responses.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login works on API URL but not Pages | Check `COOKIE_DOMAIN=.yourdomain.com` and `FRONTEND_ORIGIN` includes your Pages URL |
| CORS errors | `FRONTEND_ORIGIN` must exactly match browser origin (scheme + host) |
| Caddy no certificate | `api` DNS must be **grey cloud** and point to Oracle IP; ports 80/443 open |
| `prisma migrate` fails | Ensure Postgres is healthy: `docker compose -f docker-compose.production.yml ps` |
| 502 from Caddy | `docker compose -f docker-compose.production.yml logs app` |

---

## Security checklist before go-live

- [ ] Set `SKIP_ADMIN_LOGIN = false` in `apps/web/src/lib/devFlags.ts`
- [ ] Strong `POSTGRES_PASSWORD` and `FEEDBACK_HASH_SECRET`
- [ ] SSH key only (disable password login on VM)
- [ ] Restrict Oracle security list port 22 to your IP if possible
- [ ] Rotate any Supabase credentials if you previously exposed them

---

## Files added for this setup

| File | Purpose |
|------|---------|
| `apps/web/src/lib/api.ts` | `VITE_API_URL` for cross-origin API |
| `docker-compose.production.yml` | Postgres + API + Caddy |
| `deploy/Caddyfile` | HTTPS reverse proxy |
| `deploy/env.production.example` | VM environment template |
| `apps/web/public/_redirects` | Cloudflare Pages SPA routes |
| `scripts/oracle-bootstrap.sh` | First-time VM setup |
