-- 011_reusable_icons_rpc.sql
-- Read-only RPC exposing union custom-icon ids for the reuse selector (v1.1).
-- No table/column/RLS changes.

CREATE OR REPLACE FUNCTION get_reusable_icons(p_list_id uuid)
RETURNS TABLE(id uuid, name text, image_path text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE v_members uuid[];
BEGIN
  SELECT member_uids INTO v_members FROM lists WHERE id = p_list_id;
  IF v_members IS NULL THEN RAISE EXCEPTION 'list not found'; END IF;
  IF NOT (auth.uid() = ANY(v_members)) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY
    SELECT il.id, il.name, il.image_path, il.created_at
    FROM icon_library il
    WHERE il.account_id IN (SELECT a.id FROM accounts a WHERE a.member_uids && v_members)
    ORDER BY il.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reusable_icons(uuid) TO anon, authenticated;
