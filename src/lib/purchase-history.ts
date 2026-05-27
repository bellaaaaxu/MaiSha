import { supabase } from './supabase';
import type { PurchaseHistory, HistoryItemSnapshot } from '@/types/purchase-history';

export async function savePurchaseHistory(
  listId: string,
  supermarketId: string,
  supermarketName: string,
  items: HistoryItemSnapshot[],
  amount?: number | null,
  currency?: string,
): Promise<PurchaseHistory> {
  const bought = items.filter(i => i.checked).length;
  const row: Record<string, unknown> = {
    list_id: listId,
    supermarket_id: supermarketId,
    supermarket_name: supermarketName,
    items_snapshot: items,
    total_count: items.length,
    bought_count: bought,
  };
  if (amount != null && amount > 0) {
    row.amount = amount;
    if (currency) row.currency = currency;
  }
  const { data, error } = await supabase
    .from('purchase_history')
    .insert(row)
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

export async function deletePurchaseHistory(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('purchase_history')
    .delete()
    .in('id', ids);
  if (error) throw error;
}
