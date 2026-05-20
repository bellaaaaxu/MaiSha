-- supabase/migrations/003_custom_icons.sql
-- Custom icons and AI generation tracking

CREATE TABLE custom_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'ai_generated', 'ai_stylized')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One icon per item name per list
CREATE UNIQUE INDEX idx_custom_icons_list_name ON custom_icons(list_id, name);
CREATE INDEX idx_custom_icons_list_id ON custom_icons(list_id);

-- Auto-update updated_at
CREATE TRIGGER custom_icons_touch_updated_at
  BEFORE UPDATE ON custom_icons
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE custom_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read custom_icons"
  ON custom_icons FOR SELECT
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members insert custom_icons"
  ON custom_icons FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids))
    AND created_by = auth.uid()::text
  );

CREATE POLICY "members update custom_icons"
  ON custom_icons FOR UPDATE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members delete custom_icons"
  ON custom_icons FOR DELETE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

-- AI generation log for rate limiting
CREATE TABLE ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL,
  item_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_gen_log_user_date ON ai_generation_log(user_uid, created_at);
CREATE INDEX idx_ai_gen_log_date ON ai_generation_log(created_at);

-- RLS: only the Edge Function (service_role) writes to ai_generation_log.
-- Anon users can read their own count for display purposes.
ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own generation log"
  ON ai_generation_log FOR SELECT
  USING (user_uid = auth.uid()::text);

-- Storage bucket and policies for custom icons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('custom-icons', 'custom-icons', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "list members read custom icons"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );

CREATE POLICY "list members upload custom icons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );

CREATE POLICY "list members delete custom icons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );
