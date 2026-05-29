import { supabase } from './supabase';
import { DEFAULT_STORES } from '@/utils/constants';
import type { List } from '@/types/list';
import type { Item, NewItemInput } from '@/types/item';
import type { Store } from '@/types/store';

/** 取账号名下第一个清单；没有则创建（沿用 onboarding 选的超市）。 */
export async function getOrCreatePrimaryList(accountId: string, uid: string): Promise<List> {
  const { data: existing, error: e1 } = await supabase
    .from('lists')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing as List;

  // Use onboarding supermarket choices if available
  let supermarkets = DEFAULT_STORES;
  const onboardMarkets = localStorage.getItem('maisha:onboard-supermarkets');
  if (onboardMarkets) {
    try { supermarkets = JSON.parse(onboardMarkets); } catch { /* use default */ }
    localStorage.removeItem('maisha:onboard-supermarkets');
  }

  const { data: created, error: e2 } = await supabase
    .from('lists')
    .insert({
      name: '家里',
      owner_uid: uid,
      member_uids: [uid],
      account_id: accountId,
      supermarkets
    })
    .select()
    .single();
  if (e2) throw e2;
  return created as List;
}

export async function joinList(listId: string): Promise<List | null> {
  const { data, error } = await supabase.rpc('join_list', { p_list_id: listId });
  if (error) throw error;
  return data as List | null;
}

export async function fetchItems(listId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function addItem(listId: string, createdBy: string, input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id: listId,
      name: input.name,
      note: input.note ?? '',
      quantity: input.quantity ?? '',
      supermarket: input.supermarket ?? 'none',
      category: '其他',
      category_emoji: '📦',
      checked: false,
      checked_at: null,
      created_by: createdBy
    })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(itemId: string, patch: Partial<Item>): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

export async function clearChecked(listId: string): Promise<number> {
  const { data, error } = await supabase.rpc('clear_checked', { p_list_id: listId });
  if (error) throw error;
  return data as number;
}

export async function joinByCode(code: string): Promise<List | null> {
  const { data, error } = await supabase.rpc('join_by_code', { p_code: code });
  if (error) throw error;
  return data as List | null;
}

export async function updateListSupermarkets(listId: string, supermarkets: Store[]): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ supermarkets })
    .eq('id', listId);
  if (error) throw error;
}

export async function clearAllItems(listId: string): Promise<number> {
  const { data, error } = await supabase.rpc('clear_all_items', { p_list_id: listId });
  if (error) throw error;
  return data as number;
}
