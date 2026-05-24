import { supabase } from './supabase';
import type { PurchaseHistory, HistoryItemSnapshot } from '@/types/purchase-history';

export async function savePurchaseHistory(
  listId: string,
  supermarketId: string,
  supermarketName: string,
  items: HistoryItemSnapshot[]
): Promise<PurchaseHistory> {
  const bought = items.filter(i => i.checked).length;
  const { data, error } = await supabase
    .from('purchase_history')
    .insert({
      list_id: listId,
      supermarket_id: supermarketId,
      supermarket_name: supermarketName,
      items_snapshot: items,
      total_count: items.length,
      bought_count: bought,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PurchaseHistory;
}

export async function fetchPurchaseHistory(
  listId: string,
  limit = 50
): Promise<PurchaseHistory[]> {
  const { data, error } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('list_id', listId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PurchaseHistory[];
}

export async function fetchPurchaseHistoryById(
  id: string
): Promise<PurchaseHistory | null> {
  const { data, error } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PurchaseHistory | null;
}
