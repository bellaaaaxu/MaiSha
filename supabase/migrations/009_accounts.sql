-- 009_accounts.sql
-- 账号实体：把数据找回锚定在账号尺度（独立于按清单的邀请码）。

-- 1. 8 位找回码生成器（字母表同 005 short_code，去掉易混字符）
CREATE OR REPLACE FUNCTION generate_recovery_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- 2. accounts 表
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code TEXT UNIQUE NOT NULL DEFAULT generate_recovery_code(),
  member_uids   UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_recovery_code ON accounts(recovery_code);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read account"
  ON accounts FOR SELECT
  USING (auth.uid() = ANY(member_uids));

CREATE POLICY "members update account"
  ON accounts FOR UPDATE
  USING (auth.uid() = ANY(member_uids))
  WITH CHECK (auth.uid() = ANY(member_uids));

CREATE POLICY "authenticated create account"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = ANY(member_uids));

CREATE TRIGGER accounts_touch_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 3. lists.account_id
ALTER TABLE lists ADD COLUMN account_id UUID REFERENCES accounts(id);

-- 4. 回填：为现有每个清单建一个账号，继承成员
DO $$
DECLARE r RECORD; new_id UUID;
BEGIN
  FOR r IN SELECT id, member_uids FROM lists WHERE account_id IS NULL LOOP
    INSERT INTO accounts (member_uids) VALUES (r.member_uids) RETURNING id INTO new_id;
    UPDATE lists SET account_id = new_id WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE lists ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX idx_lists_account_id ON lists(account_id);

-- 5. 收紧 lists INSERT：新清单必须挂在调用者所属的账号下
DROP POLICY "authenticated create list" ON lists;
CREATE POLICY "authenticated create list"
  ON lists FOR INSERT
  WITH CHECK (
    auth.uid() = owner_uid
    AND auth.uid() = ANY(member_uids)
    AND account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids))
  );

-- 6. claim_account：把 uid 加进账号 + 名下所有清单的 member_uids，使现有成员制 RLS 原样生效
CREATE OR REPLACE FUNCTION claim_account(p_code TEXT)
RETURNS accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account accounts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_account FROM accounts WHERE recovery_code = upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF NOT (auth.uid() = ANY(v_account.member_uids)) THEN
    UPDATE accounts
      SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
      WHERE id = v_account.id
      RETURNING * INTO v_account;
  END IF;

  UPDATE lists
    SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
    WHERE account_id = v_account.id AND NOT (auth.uid() = ANY(member_uids));

  RETURN v_account;
END;
$$;
