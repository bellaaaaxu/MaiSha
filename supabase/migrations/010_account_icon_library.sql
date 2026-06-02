-- 010_account_icon_library.sql
-- Move custom icons from per-list to per-account (icon_library), add the (empty-in-v1)
-- list_icon_assignments table, and a union RPC. See spec 2026-05-31-account-icon-library-design.md.
--
-- !!! RUN THE READ-ONLY AUDIT BELOW *BEFORE* APPLYING. Expect collision count ~= 0. !!!
--   SELECT count(*) AS total_icons FROM custom_icons;
--   SELECT count(*) AS would_collide FROM (
--     SELECT 1 FROM custom_icons c
--     JOIN lists l ON l.id = c.list_id
--     GROUP BY l.account_id, c.name HAVING count(*) > 1
--   ) x;
--   SELECT count(*) AS orphan_created_by FROM custom_icons c
--   WHERE NOT EXISTS (
--     SELECT 1 FROM accounts a WHERE a.member_uids @> ARRAY[c.created_by::uuid]
--   );

BEGIN;

-- 1. Rename (keeps data, storage paths, FKs, trigger).
ALTER TABLE custom_icons RENAME TO icon_library;

-- 2. Drop old list-based RLS (they reference list_id, which we drop below).
DROP POLICY IF EXISTS "members read custom_icons"   ON icon_library;
DROP POLICY IF EXISTS "members insert custom_icons" ON icon_library;
DROP POLICY IF EXISTS "members update custom_icons" ON icon_library;
DROP POLICY IF EXISTS "members delete custom_icons" ON icon_library;

-- 3. Add account_id (nullable for backfill).
ALTER TABLE icon_library ADD COLUMN account_id UUID REFERENCES accounts(id);

-- 4. Backfill: created_by's account (earliest), else the row's list's account.
UPDATE icon_library il SET account_id = COALESCE(
  (SELECT a.id FROM accounts a
     WHERE a.member_uids @> ARRAY[il.created_by::uuid]
     ORDER BY a.created_at ASC LIMIT 1),
  (SELECT l.account_id FROM lists l WHERE l.id = il.list_id)
);

-- 5. Dedup (account_id, name): keep created_at EARLIEST (ties -> smaller id), delete rest. Logged.
DO $$
DECLARE n INT;
BEGIN
  WITH del AS (
    DELETE FROM icon_library a USING icon_library b
    WHERE a.account_id = b.account_id AND a.name = b.name
      AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))
    RETURNING a.id
  )
  SELECT count(*) INTO n FROM del;
  RAISE NOTICE '010 dedup: deleted % duplicate icon_library row(s)', n;
END $$;

-- 6. Lock account_id, swap unique key + indexes (dropping list_id removes its dependent index).
ALTER TABLE icon_library ALTER COLUMN account_id SET NOT NULL;
DROP INDEX IF EXISTS idx_custom_icons_list_name;
ALTER TABLE icon_library DROP COLUMN list_id;
CREATE UNIQUE INDEX idx_icon_library_account_name ON icon_library(account_id, name);
CREATE INDEX idx_icon_library_account ON icon_library(account_id);

-- 7. New account-based RLS.
CREATE POLICY "account members read icon_library" ON icon_library FOR SELECT
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "account members insert icon_library" ON icon_library FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids))
    AND created_by = auth.uid()::text
  );
CREATE POLICY "account members update icon_library" ON icon_library FOR UPDATE
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "account members delete icon_library" ON icon_library FOR DELETE
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));

-- 8. GIN index on accounts.member_uids for the union overlap query (&&).
CREATE INDEX IF NOT EXISTS idx_accounts_member_uids_gin ON accounts USING GIN (member_uids);

-- 9. list_icon_assignments (empty in v1; written in v1.1).
CREATE TABLE list_icon_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon_id    UUID NOT NULL REFERENCES icon_library(id) ON DELETE CASCADE,
  set_by     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_lia_list_name ON list_icon_assignments(list_id, name);
CREATE INDEX idx_lia_list ON list_icon_assignments(list_id);
CREATE TRIGGER lia_touch_updated_at BEFORE UPDATE ON list_icon_assignments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
ALTER TABLE list_icon_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list members read lia" ON list_icon_assignments FOR SELECT
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "list members insert lia" ON list_icon_assignments FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids))
    AND set_by = auth.uid()::text
  );
CREATE POLICY "list members update lia" ON list_icon_assignments FOR UPDATE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "list members delete lia" ON list_icon_assignments FOR DELETE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

-- 10. Union RPC: members' accounts' libraries + this list's assignments.
CREATE OR REPLACE FUNCTION get_list_icon_map(p_list_id uuid)
RETURNS TABLE(name text, image_path text, source text, kind text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_members uuid[];
BEGIN
  SELECT member_uids INTO v_members FROM lists WHERE id = p_list_id;
  IF v_members IS NULL THEN RAISE EXCEPTION 'list not found'; END IF;
  IF NOT (auth.uid() = ANY(v_members)) THEN RAISE EXCEPTION 'not a member'; END IF;

  RETURN QUERY
    SELECT il.name, il.image_path, il.source, 'library'::text, il.created_at, il.updated_at
    FROM icon_library il
    WHERE il.account_id IN (SELECT a.id FROM accounts a WHERE a.member_uids && v_members)
    UNION ALL
    SELECT la.name, il.image_path, il.source, 'assignment'::text, il.created_at, la.updated_at
    FROM list_icon_assignments la JOIN icon_library il ON il.id = la.icon_id
    WHERE la.list_id = p_list_id;
END;
$$;
GRANT EXECUTE ON FUNCTION get_list_icon_map(uuid) TO anon, authenticated;

-- 11. ai_generation_log: account_id + ip for per-account quota + monitoring.
ALTER TABLE ai_generation_log ADD COLUMN account_id UUID REFERENCES accounts(id);
ALTER TABLE ai_generation_log ADD COLUMN ip TEXT;
CREATE INDEX idx_ai_gen_log_account_date ON ai_generation_log(account_id, created_at);

-- 12. Storage: allow writes to {account_id}/ (bucket stays public-read; old list-folder policies remain for old files).
CREATE POLICY "account members upload icons" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM accounts WHERE auth.uid() = ANY(member_uids))
  );
CREATE POLICY "account members delete icons" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM accounts WHERE auth.uid() = ANY(member_uids))
  );

COMMIT;
