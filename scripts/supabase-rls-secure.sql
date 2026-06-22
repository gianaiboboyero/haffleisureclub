-- Supabase RLS Security Fix: Prevent anonymous users from extracting PII
-- Run: npx prisma db execute --file scripts/supabase-rls-secure.sql --schema prisma/schema.prisma

-- PostgreSQL Column Level Privileges
-- Revoke all permissions on the sensitive columns for anon role.
REVOKE SELECT (phone, email, "fullName") ON "Player" FROM anon;
REVOKE SELECT (phone, email, "fullName") ON "Player" FROM public;

-- Also revoke from authenticated role unless they need it?
-- The frontend only needs displayName, so we can revoke from authenticated as well,
-- since authenticated here just means any logged in user (who also shouldn't dump PII).
-- The admin API bypasses RLS and Column Privileges by using service_role key.
REVOKE SELECT (phone, email, "fullName") ON "Player" FROM authenticated;
