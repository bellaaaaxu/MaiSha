-- 012_multi_list.sql
-- Multi-list: state column (pinned/active/archived) + pin_order + guarded RPCs.

ALTER TABLE lists
  ADD COLUMN state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'pinned', 'archived')),
  ADD COLUMN pin_order integer;

CREATE INDEX idx_lists_account_state ON lists (account_id, state);

-- Existing 「家里」 lists default to pinned (users expect 「家里」 always on top).
UPDATE lists SET state = 'pinned', pin_order = 0
  WHERE name = '家里' AND state = 'active';

-- Set a list's state with guardrail: reject if archiving would leave 0 active+pinned.
CREATE OR REPLACE FUNCTION set_list_state(
  p_list_id uuid,
  p_state text,
  p_pin_order integer DEFAULT NULL
) RETURNS lists
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_active_count integer;
  v_result lists;
BEGIN
  SELECT account_id INTO v_account_id FROM lists
  WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF p_state NOT IN ('active', 'pinned', 'archived') THEN
    RAISE EXCEPTION 'invalid state: %', p_state;
  END IF;

  IF p_state = 'archived' THEN
    SELECT count(*) INTO v_active_count FROM lists
    WHERE account_id = v_account_id
      AND state IN ('active', 'pinned')
      AND id <> p_list_id;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'cannot archive the last active list';
    END IF;
  END IF;

  UPDATE lists
    SET state = p_state,
        pin_order = CASE WHEN p_state = 'pinned' THEN p_pin_order ELSE NULL END,
        updated_at = now()
    WHERE id = p_list_id
    RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- Delete a list with same guardrail (last active+pinned cannot be removed).
CREATE OR REPLACE FUNCTION delete_list(p_list_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_active_count integer;
  v_state text;
BEGIN
  SELECT account_id, state INTO v_account_id, v_state FROM lists
    WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF v_state IN ('active', 'pinned') THEN
    SELECT count(*) INTO v_active_count FROM lists
      WHERE account_id = v_account_id
        AND state IN ('active', 'pinned')
        AND id <> p_list_id;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'cannot delete the last active list';
    END IF;
  END IF;

  DELETE FROM lists WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
END;
$$;

GRANT EXECUTE ON FUNCTION set_list_state(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_list(uuid) TO anon, authenticated;
