-- Lock down browser-direct Player profile writes, avatar uploads, and session mutations.
-- Profile changes → /api/player-profile (auth + ownership).
-- Live stack/courts/matches → /api/club-state (auth + role checks).
-- Run: npm run db:rls-profile-lockdown

-- Player: keep public read for roster/TV; block anon insert/update (use API instead)
DROP POLICY IF EXISTS "haff_anon_write_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_update_player" ON "Player";
REVOKE INSERT, UPDATE ON "Player" FROM anon, authenticated;

-- Session: reads stay open for TV/realtime; writes only via server API
DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_insert_session" ON "Session";
REVOKE INSERT, UPDATE ON "Session" FROM anon, authenticated;

-- Avatars: public read by path; writes only via service role on the server
DROP POLICY IF EXISTS "haff_avatar_player_write" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_player_update" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_player_delete" ON storage.objects;
