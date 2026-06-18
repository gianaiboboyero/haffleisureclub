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
  USING (true)
  WITH CHECK (true);

-- Courts: read + update only (seed via server scripts)
CREATE POLICY "haff_anon_update_court" ON "Court"
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Session: live stack sync
CREATE POLICY "haff_anon_update_session" ON "Session"
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

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
