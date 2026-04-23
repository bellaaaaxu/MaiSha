-- 001_initial_schema.sql
-- 买啥 MaiSha v1 - Initial schema

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tables
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '家里',
  owner_uid UUID NOT NULL,
  member_uids UUID[] NOT NULL DEFAULT '{}',
  supermarkets JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  quantity TEXT NOT NULL DEFAULT '',
  supermarket TEXT NOT NULL DEFAULT 'none',
  category TEXT NOT NULL DEFAULT '其他',
  category_emoji TEXT NOT NULL DEFAULT '📦',
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_list_id ON items(list_id);
CREATE INDEX idx_items_list_created ON items(list_id, created_at);

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Lists policies
CREATE POLICY "members read list"
  ON lists FOR SELECT
  USING (auth.uid() = ANY(member_uids));

CREATE POLICY "members update list"
  ON lists FOR UPDATE
  USING (auth.uid() = ANY(member_uids))
  WITH CHECK (auth.uid() = ANY(member_uids));

CREATE POLICY "authenticated create list"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = owner_uid AND auth.uid() = ANY(member_uids));

-- Items policies
CREATE POLICY "members read items"
  ON items FOR SELECT
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members insert items"
  ON items FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids))
    AND created_by = auth.uid()
  );

CREATE POLICY "members update items"
  ON items FOR UPDATE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members delete items"
  ON items FOR DELETE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

-- RPC: join_list (allow current user to join an existing list by id)
CREATE OR REPLACE FUNCTION join_list(p_list_id UUID)
RETURNS lists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE lists
  SET member_uids = array_append(member_uids, auth.uid()),
      updated_at = NOW()
  WHERE id = p_list_id
    AND NOT (auth.uid() = ANY(member_uids))
  RETURNING * INTO result;

  IF NOT FOUND THEN
    -- Either list doesn't exist or user already a member; return the list if exists
    SELECT * INTO result FROM lists WHERE id = p_list_id;
  END IF;

  RETURN result;
END;
$$;

-- RPC: clear_checked
CREATE OR REPLACE FUNCTION clear_checked(p_list_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Require caller to be a member of the list
  IF NOT EXISTS (SELECT 1 FROM lists WHERE id = p_list_id AND auth.uid() = ANY(member_uids)) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  DELETE FROM items WHERE list_id = p_list_id AND checked = TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Updated_at auto update
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_touch_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER lists_touch_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
