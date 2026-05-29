import { supabase } from './supabase';
import type { Account } from '@/types/account';

/** 找当前 uid 所属的账号（热启动路径）。 */
export async function findAccountForUid(uid: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .contains('member_uids', [uid])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Account) ?? null;
}

/** 真·新用户：建一个只含自己的账号（recovery_code 由 DB 默认生成）。 */
export async function createAccount(uid: string): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ member_uids: [uid] })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

/** 用找回码认领账号：把当前 uid 喷进账号及其名下清单。找不到码返回 null。 */
export async function claimAccount(code: string): Promise<Account | null> {
  const { data, error } = await supabase.rpc('claim_account', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return (data as Account) ?? null;
}
