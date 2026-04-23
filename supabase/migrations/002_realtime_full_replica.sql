-- 002_realtime_full_replica.sql
-- Fix: Realtime DELETE events were not matching the list_id filter.
-- PostgreSQL's default REPLICA IDENTITY logs only the primary key for
-- DELETEs; so `payload.old` only contains `id`. Supabase Realtime's
-- server-side filter `list_id=eq.<uuid>` therefore never matches on
-- DELETE events, and the client never learns the row was removed.
--
-- Switching REPLICA IDENTITY to FULL makes the WAL log all columns
-- for UPDATE and DELETE, which lets Realtime filters work on DELETEs.

ALTER TABLE items REPLICA IDENTITY FULL;
ALTER TABLE lists REPLICA IDENTITY FULL;
