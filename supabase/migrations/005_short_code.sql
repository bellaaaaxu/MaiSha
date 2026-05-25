-- 005_short_code.sql
-- Add short_code to lists for easy sharing (like Discord room codes)

-- Generate a random 6-char uppercase alphanumeric code (excluding 0/O/1/I/L)
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Add column with unique constraint
ALTER TABLE lists ADD COLUMN short_code TEXT UNIQUE;

-- Backfill existing lists
UPDATE lists SET short_code = generate_short_code() WHERE short_code IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE lists ALTER COLUMN short_code SET NOT NULL;
ALTER TABLE lists ALTER COLUMN short_code SET DEFAULT generate_short_code();

-- Index for fast lookup
CREATE INDEX idx_lists_short_code ON lists(short_code);

-- RPC: join by short code
CREATE OR REPLACE FUNCTION join_by_code(p_code TEXT)
RETURNS lists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
  result lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO target_id FROM lists WHERE short_code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Reuse join_list logic
  UPDATE lists
  SET member_uids = array_append(member_uids, auth.uid()),
      updated_at = NOW()
  WHERE id = target_id
    AND NOT (auth.uid() = ANY(member_uids))
  RETURNING * INTO result;

  IF NOT FOUND THEN
    SELECT * INTO result FROM lists WHERE id = target_id;
  END IF;

  RETURN result;
END;
$$;

-- Allow anyone authenticated to read a list by short_code (for join flow)
CREATE POLICY "anyone can read list by short_code"
  ON lists FOR SELECT
  USING (auth.uid() IS NOT NULL);
