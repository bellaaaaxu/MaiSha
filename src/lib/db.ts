import { supabase } from './supabase';
import { DEFAULT_STORES } from '@/utils/constants';
import { buildExampleItems } from '@/utils/example-items';
import type { List, ListState } from '@/types/list';
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

  // 新用户首单预置 3 件示例商品当零成本引导（勾掉/删掉即毕业）；失败不阻断建单。
  // 邀请加入者走 joinOrGetList，永不到达这里；db 层插入也天然绕过埋点与常买记录。
  try {
    const lang = localStorage.getItem('maisha:language');
    const firstStore = supermarkets.find(s => s.id !== 'none')?.id ?? 'none';
    const rows = buildExampleItems(lang, firstStore).map(r => ({
      list_id: (created as List).id,
      name: r.name,
      note: r.note,
      quantity: r.quantity,
      supermarket: r.supermarket,
      category: '其他',
      category_emoji: '📦',
      checked: false,
      checked_at: null,
      created_by: uid,
    }));
    await supabase.from('items').insert(rows);
  } catch { /* 示例商品非关键 */ }

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

/** 创建新清单（自动 active；自动 owner=member）。 */
export async function createList(
  accountId: string,
  uid: string,
  name: string,
  supermarkets: Store[]
): Promise<List> {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      name,
      owner_uid: uid,
      member_uids: [uid],
      account_id: accountId,
      supermarkets,
    })
    .select()
    .single();
  if (error) throw error;
  return data as List;
}

/** 重命名（直接 update；RLS 允许成员写）。 */
export async function renameList(listId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ name })
    .eq('id', listId);
  if (error) throw error;
}

/** 设置状态（pinned/active/archived），含 DB 护栏。 */
export async function setListState(
  listId: string,
  state: ListState,
  pinOrder?: number | null
): Promise<List> {
  const { data, error } = await supabase.rpc('set_list_state', {
    p_list_id: listId,
    p_state: state,
    p_pin_order: pinOrder ?? null,
  });
  if (error) throw error;
  return data as List;
}

/** 删除清单，含 DB 护栏（拒绝删最后一个 active+pinned）。 */
export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_list', { p_list_id: listId });
  if (error) throw error;
}

/** 列出某账号下的所有清单（含 archived）。 */
export async function fetchListsByAccount(accountId: string): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as List[];
}
