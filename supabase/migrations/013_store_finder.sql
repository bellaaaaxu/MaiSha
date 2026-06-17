-- 013_store_finder.sql
-- Reverse store-finder: shared product→store-type keyword cache + a tiny global
-- daily query counter (kept separate from ai_generation_log so it never inflates
-- the icon-generation quota).

-- Shared, NOT account-scoped: first global querier of a product pays the AI call,
-- everyone else reads the cached keywords for free.
CREATE TABLE store_type_hints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_normalized text UNIQUE NOT NULL,
  keywords        jsonb NOT NULL,         -- [{ "term": "...", "tier": 1 }, ...]
  source          text NOT NULL DEFAULT 'ai' CHECK (source IN ('seed', 'ai')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_type_hints ENABLE ROW LEVEL SECURITY;

-- Any authenticated/anon user can READ the shared cache.
CREATE POLICY store_type_hints_read ON store_type_hints
  FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE policy → only the Edge Function (service role) can write.

-- Global daily cost backstop counter (rarely hit thanks to caching).
CREATE TABLE store_type_query_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid        uuid,
  name_normalized text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_type_query_log_created ON store_type_query_log (created_at);

ALTER TABLE store_type_query_log ENABLE ROW LEVEL SECURITY;
-- No policies → only the Edge Function (service role) reads/writes it.
