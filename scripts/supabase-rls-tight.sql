-- Tighter RLS: reads open for club ops; writes limited; chat write stays on Vercel API.
-- Run after scripts/supabase-rls.sql when policies change.

DROP POLICY IF EXISTS "haff_anon_write_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_update_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_write_court" ON "Court";
DROP POLICY IF EXISTS "haff_anon_update_court" ON "Court";
DROP POLICY IF EXISTS "haff_anon_write_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_insert_session" ON "Session";

-- Player: roster read + profile update (no anon insert — use sync API / admin tools)
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

-- Courts: browser read only; court writes go through Session.settings + /api sync
REVOKE UPDATE ON "Court" FROM anon, authenticated;
DROP POLICY IF EXISTS "haff_anon_update_court" ON "Court";

-- Session: live stack sync (active session only)
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

CREATE POLICY "haff_anon_insert_session" ON "Session"
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'Active');

-- Reservations: calendar reads only from browser (writes via /api/reservations)
REVOKE INSERT, UPDATE, DELETE ON "CourtReservation" FROM anon;
GRANT SELECT ON "CourtReservation" TO anon, authenticated;

ALTER TABLE "CourtReservation" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "haff_anon_read_reservation" ON "CourtReservation";
CREATE POLICY "haff_anon_read_reservation" ON "CourtReservation"
  FOR SELECT TO anon, authenticated
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "CourtReservation";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
