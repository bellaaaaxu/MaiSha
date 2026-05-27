-- 007_purchase_history_delete.sql
-- Allow list members to delete their purchase history records.

CREATE POLICY "Members can delete history" ON public.purchase_history
  FOR DELETE USING (
    list_id IN (
      SELECT id FROM public.lists WHERE auth.uid() = ANY(member_uids)
    )
  );
