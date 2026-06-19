-- Supabase Storage for versioned player avatars (WebP).
-- Run: npx prisma db execute --file scripts/supabase-storage.sql --schema prisma/schema.prisma

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "haff_avatar_public_read" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_object_read" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_player_write" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_player_update" ON storage.objects;
DROP POLICY IF EXISTS "haff_avatar_player_delete" ON storage.objects;

-- Path-scoped read (public bucket URLs work without listing the whole bucket)
CREATE POLICY "haff_avatar_object_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'avatars'
    AND name ~ '^[A-Za-z0-9_-]+/v[0-9]+\.webp$'
  );

CREATE POLICY "haff_avatar_player_write" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] ~ '^[A-Za-z0-9_-]+$'
  );

CREATE POLICY "haff_avatar_player_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "haff_avatar_player_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'avatars');
