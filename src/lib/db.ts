import { supabase } from './supabase';
import { DEFAULT_SUPERMARKETS } from '@/utils/constants';
import type { List } from '@/types/list';
import type { Item, NewItemInput } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';

/** Fetch the current user's list. If none, create one. */
export async function getOrCreateList(uid: string): Promise<List> {
  // Try find existing
  const { data: existing, error: e1 } = await supabase
    .from('lists')
    .select('*')
    .contains('member_uids', [uid])
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing as List;

  // Create new
  const { data: created, error: e2 } = await supabase
    .from('lists')
    .insert({
      name: '家里',
      owner_uid: uid,
      member_uids: [uid],
      supermarkets: DEFAULT_SUPERMARKETS
    })
    .select()
    .single();
  if (e2) throw e2;
  return created as List;
}

export async function joinList(listId: string): Promise<List> {
  const { data, error } = await supabase.rpc('join_list', { p_list_id: listId });
  if (error) throw error;
  return data as List;
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
      category: input.category ?? '其他',
      category_emoji: input.category_emoji ?? '📦',
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

export async function updateListSupermarkets(listId: string, supermarkets: Supermarket[]): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ supermarkets })
    .eq('id', listId);
  if (error) throw error;
}
