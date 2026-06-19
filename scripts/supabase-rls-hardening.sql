-- Harden permissive RLS + storage policies (Supabase linter 0024 / 0025).
-- Run: npx prisma db execute --file scripts/supabase-rls-hardening.sql --schema prisma/schema.prisma

-- Court: browser only reads; live court state is in Session.settings (no anon UPDATE)
DROP POLICY IF EXISTS "haff_anon_update_court" ON "Court";
REVOKE UPDATE ON "Court" FROM anon, authenticated;

-- Player: profile updates only with basic field validation (not USING/WITH CHECK true)
DROP POLICY IF EXISTS "haff_anon_update_player" ON "Player";
CREATE POLICY "haff_anon_update_player" ON "Player"
  FOR UPDATE TO anon, authenticated
  USING (
    id IS NOT NULL
    AND char_length(id) BETWEEN 8 AND 64
    AND status IN ('Active', 'Inactive')
  )
  WITH CHECK (
    id IS NOT NULL
    AND char_length(id) BETWEEN 8 AND 64
    AND "displayName" IS NOT NULL
    AND char_length(btrim("displayName")) BETWEEN 1 AND 120
    AND "skillLevel" IS NOT NULL
    AND char_length(btrim("skillLevel")) > 0
    AND rating >= 0
    AND rating <= 10
    AND status IN ('Active', 'Inactive')
    AND "totalGamesPlayed" >= 0
    AND "totalDaysPlayed" >= 0
  );

-- Session: only the active session row can be updated (live stack sync)
DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
CREATE POLICY "haff_anon_update_session" ON "Session"
  FOR UPDATE TO anon, authenticated
  USING (status = 'Active')
  WITH CHECK (
    status = 'Active'
    AND name IS NOT NULL
    AND char_length(btrim(name)) > 0
    AND mode IS NOT NULL
    AND char_length(btrim(mode)) > 0
  );

-- Avatars: public URLs work without a bucket-wide SELECT; block directory listing
DROP POLICY IF EXISTS "haff_avatar_public_read" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_object_read" ON storage.objects;

CREATE POLICY "haff_avatar_object_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'avatars'
    AND name ~ '^[A-Za-z0-9_-]+/v[0-9]+\.webp$'
  );
