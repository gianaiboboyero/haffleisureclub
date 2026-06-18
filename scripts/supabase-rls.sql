-- Supabase direct client access for HAFF PicklePulse (browser reads/writes).
-- Run: npx prisma db execute --file scripts/supabase-rls.sql --schema prisma/schema.prisma

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON "Player" TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON "Court" TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON "Session" TO anon, authenticated;
GRANT SELECT ON "ChatMessage" TO anon, authenticated;
GRANT SELECT ON "User" TO anon, authenticated;

ALTER TABLE "Player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Court" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "haff_anon_read_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_write_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_update_player" ON "Player";
DROP POLICY IF EXISTS "haff_anon_read_court" ON "Court";
DROP POLICY IF EXISTS "haff_anon_write_court" ON "Court";
DROP POLICY IF EXISTS "haff_anon_update_court" ON "Court";
DROP POLICY IF EXISTS "haff_anon_read_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_write_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
DROP POLICY IF EXISTS "haff_anon_read_chat" ON "ChatMessage";
DROP POLICY IF EXISTS "haff_anon_read_user" ON "User";

CREATE POLICY "haff_anon_read_player" ON "Player" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "haff_anon_write_player" ON "Player" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "haff_anon_update_player" ON "Player" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "haff_anon_read_court" ON "Court" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "haff_anon_write_court" ON "Court" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "haff_anon_update_court" ON "Court" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "haff_anon_read_session" ON "Session" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "haff_anon_write_session" ON "Session" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "haff_anon_update_session" ON "Session" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "haff_anon_read_chat" ON "ChatMessage" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "haff_anon_read_user" ON "User" FOR SELECT TO anon, authenticated USING (true);

-- Realtime (ignore errors if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "Session";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "Player";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "Court";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "ChatMessage";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
