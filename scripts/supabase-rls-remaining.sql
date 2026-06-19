-- Enable RLS on tables not exposed to the browser Supabase client.
-- Server routes use Prisma (postgres role) and bypass RLS; anon/authenticated get no policies = deny.
-- Run: npx prisma db execute --file scripts/supabase-rls-remaining.sql --schema prisma/schema.prisma

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Match',
    'SyncEvent',
    'Notification',
    'ImprovementReport',
    'CourtReservationSetting',
    'CourtAllocation',
    'CourtBlackout',
    'UserNotification',
    'AuthSession',
    'ChatReaction',
    'ChatReport',
    'Testimonial',
    'AuditLog',
    'OperationEvent'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;
