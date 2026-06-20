# Security patch changelog

## 2026-06-20 — Audit remediation (SEC-03, SEC-05, SEC-07, SEC-09, SEC-10, SEC-13, SEC-14, SEC-15, SEC-01, SEC-04, SEC-16)

| File | Change |
|------|--------|
| `api/_security.ts` | **Added** — shared password, PII DTO, feedback secret, avatar URL helpers |
| `tests/security.test.mjs` | **Added** — regression tests for security helpers |
| `api/players.ts` | Public roster DTO without phone/email; full export for admins only |
| `api/auth.ts` | Min 8-char passwords; login failure rate limit; production CAPTCHA when configured |
| `api/feedback.ts` | Fail closed in production without `FEEDBACK_HASH_SECRET` |
| `api/reservations.ts` | Fix email leak in public week view; stop unauthenticated DB bootstrap |
| `api/player-profile.ts` | Restrict external avatar URLs; generic upload errors in production |
| `api/realtime/token.ts` | Optional `TV_DEVICE_SECRET` gate for TV Ably tokens |
| `apps/api/src/sync.controller.ts` | Require `SYNC_API_KEY` header for local Nest sync |
| `apps/web/src/lib/supabase/clubState.ts` | Disable direct Session writes (`publishClubState`, `broadcastTvState`) |
| `apps/web/src/lib/supabase/players.ts` | Disable direct Player upserts; drop phone/statusNote from compact SELECT |
| `apps/web/src/lib/supabase/playerUpdate.ts` | Stop mapping phone/statusNote from public compact rows |
| `apps/web/src/components/LandingView.tsx` | Remove localStorage admin bypass; use server role prop |
| `apps/web/src/components/ReservationCalendar.tsx` | Remove localStorage admin bypass |
| `apps/web/src/main.tsx` | Pass admin role into landing CMS; remove demo login hint |
| `scripts/supabase-rls-profile-lockdown.sql` | Revoke anon SELECT on `User`; column-scoped anon SELECT on `Player` |
| `scripts/merge-production-roster.mjs` | Prefer Prisma over public `/api/players` when `DATABASE_URL` set |
| `package.json` | Add `test:security` script |
| `docs/VERCEL_SUPABASE_DEPLOY.md` | Document new env vars and security tests |
