# HAFF PicklePulse — Coolify + Hetzner VPS Setup

Deploy the app on your own VPS with **flat monthly cost** and **no Vercel bandwidth limits**.

**Estimated cost:** ~€4–8/month (Hetzner CPX11–CPX21) + your domain on Namecheap.

---

## What you get

- React frontend + Node API in one Docker container
- Optional Postgres on the same VPS (or keep Supabase/Neon via `DATABASE_URL`)
- Automatic HTTPS via Coolify (Let’s Encrypt)
- Git push deploys from GitHub

---

## Part 1 — Create Hetzner VPS

1. Go to [https://www.hetzner.com/cloud](https://www.hetzner.com/cloud) and create an account.
2. **New Project** → **Add Server**.
3. Recommended settings:

| Setting | Value |
|---------|--------|
| Location | **Singapore** (`sin`) if most users are in PH; or **Nuremberg** (`nbg`) for EU |
| Image | **Ubuntu 24.04** |
| Type | **CPX11** (2 vCPU, 2 GB RAM, ~€4.35/mo) — enough to start |
| Networking | Public IPv4 + IPv6 |
| SSH key | Add your Mac’s public key (`cat ~/.ssh/id_ed25519.pub`) |
| Name | `haff-coolify` |

4. Create server and note the **public IP** (e.g. `65.x.x.x`).

### Firewall (Hetzner Cloud Console)

Create a firewall and attach it to the server:

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Inbound | TCP | 22 | Your IP only (SSH) |
| Inbound | TCP | 80 | 0.0.0.0/0 |
| Inbound | TCP | 443 | 0.0.0.0/0 |
| Inbound | TCP | 8000 | Your IP only (Coolify UI, first setup only) |

After Coolify is configured, you can close port 8000 to the public and use HTTPS on 443 only.

---

## Part 2 — Install Coolify on the VPS

SSH into the server:

```bash
ssh root@YOUR_SERVER_IP
```

Run the official installer:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

When it finishes, open:

```text
http://YOUR_SERVER_IP:8000
```

1. Create your **Coolify admin** email + password.
2. Choose **localhost** (Coolify runs on this same VPS).

---

## Part 3 — Push code to GitHub (if not already)

Coolify deploys from Git. On your Mac:

```bash
cd "/Users/mbam22022/Documents/Haff Leisure Club"
git add Dockerfile docker-compose.yml server/ .dockerignore docs/COOLIFY_HETZNER_SETUP.md package.json
git commit -m "Add Coolify/Hetzner Docker deployment"
git push
```

---

## Part 4 — Deploy the app in Coolify

1. In Coolify: **+ New Resource** → **Application**.
2. **Source:** GitHub → connect your account → select **Haff Leisure Club** repo.
3. **Build pack:** **Docker Compose** (or **Dockerfile** if you prefer single container).
4. **Branch:** `main` (or your deploy branch).
5. **Docker Compose location:** `/docker-compose.yml`
6. **Port:** `3000` (mapped in compose file).

### Environment variables (Coolify → Application → Environment)

Copy from your old Vercel project:

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `DIRECT_URL` | Yes | Same as DATABASE_URL (or direct Supabase host) |
| `INITIAL_ADMIN_EMAIL` | Recommended | Your admin email |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile |
| `ABLY_API_KEY` | Optional | Realtime chat |
| `FEEDBACK_HASH_SECRET` | Optional | Any random string |

7. Click **Deploy**.

First build takes ~5–10 minutes (npm install + Vite build + Prisma).

Test:

```text
http://YOUR_SERVER_IP:3000/health
```

Should return `{"ok":true}`.

---

## Part 5 — Connect Namecheap domain

### In Coolify

1. Open your application → **Domains**.
2. Add:
   - `yourdomain.com`
   - `www.yourdomain.com`
3. Coolify shows the IP or CNAME to use (usually your server IP for A record).

### In Namecheap

1. **Domain List** → **Manage** → **Advanced DNS**.
2. Remove old **Vercel** records (`76.76.21.21`, `cname.vercel-dns.com`).
3. Add:

| Type | Host | Value |
|------|------|-------|
| **A** | `@` | `YOUR_HETZNER_IP` |
| **CNAME** | `www` | `yourdomain.com` |

4. Save. SSL is automatic via Coolify (Let’s Encrypt) — usually 15–60 minutes.

### Remove domain from Vercel (if still linked)

Vercel → Project → **Settings** → **Domains** → Remove domain.

---

## Part 6 — Optional: Postgres on the same VPS

If you want to drop Supabase later:

1. In `docker-compose.yml`, uncomment the `postgres` service and `volumes`.
2. Set in Coolify env:

```env
DATABASE_URL=postgresql://haff:YOUR_STRONG_PASSWORD@postgres:5432/haff
DIRECT_URL=postgresql://haff:YOUR_STRONG_PASSWORD@postgres:5432/haff
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
```

3. Run migrations once:

```bash
# SSH to server, then into the app container
docker exec -it <container> npx prisma migrate deploy
```

---

## Part 7 — TV and club night testing

After domain is live:

| Device | URL |
|--------|-----|
| Admin | `https://yourdomain.com/admin` |
| TV | `https://yourdomain.com/tv` |
| Player | `https://yourdomain.com/player` |

Log in on the TV browser once (session cookie required for sync).

---

## Local test before deploying

```bash
npm install
npm run build:web
DATABASE_URL="your-db-url" DIRECT_URL="your-db-url" npm start
```

Open `http://localhost:3000`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Ensure `DATABASE_URL` is set in Coolify env (generate step needs schema) |
| 502 after deploy | Check logs in Coolify; confirm port 3000 |
| API 401 on TV | Log in on TV browser |
| SSL not issued | DNS must point to Hetzner IP; wait up to 1 hour |
| Out of memory on CPX11 | Upgrade to CPX21 (4 GB RAM) |

---

## Cost summary

| Item | Monthly |
|------|---------|
| Hetzner CPX11 | ~€4.35 |
| Coolify | Free (self-hosted) |
| Namecheap domain | ~$10–15/year |
| Supabase (if kept) | $0 free tier |

**No per-GB bandwidth panic** like Vercel Hobby.

---

## Quick command reference

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Coolify logs (on server)
docker ps
docker logs -f <app-container-id>

# Redeploy: push to GitHub — Coolify auto-deploys if webhook enabled
```
