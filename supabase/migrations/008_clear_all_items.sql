-- 008_clear_all_items.sql
-- RPC to delete all items in a list (regardless of checked state).
-- Supermarket categories on the list itself are preserved.

CREATE OR REPLACE FUNCTION clear_all_items(p_list_id UUID)
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

  IF NOT EXISTS (SELECT 1 FROM lists WHERE id = p_list_id AND auth.uid() = ANY(member_uids)) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  DELETE FROM items WHERE list_id = p_list_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
