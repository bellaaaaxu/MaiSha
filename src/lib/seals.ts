// 钤印集章：发放规则纯函数 + Supabase 读写。spec: docs/superpowers/specs/2026-07-19-seal-collection-design.md
// seal_id = flora 成员 id（decor-registry 同源），永不改名。
import { supabase } from './supabase';

export const RESIDENT_SEALS = ['lan', 'zhu', 'ju', 'song', 'yinxing', 'feng', 'ziteng', 'luwei'] as const;

export interface SeasonalSeal {
  id: string;
  /** [month, day] 窗口起（含） */
  from: [number, number];
  /** [month, day] 窗口止（含） */
  to: [number, number];
}
// 固定月日近似节气（精确历法 = Non-goal）；梅窗跨年
export const SEASONAL_SEALS: SeasonalSeal[] = [
  { id: 'shuixian', from: [2, 1],  to: [3, 15] },
  { id: 'he',       from: [6, 15], to: [8, 15] },
  { id: 'gui',      from: [9, 1],  to: [10, 15] },
  { id: 'mei',      from: [12, 1], to: [1, 31] },
];

function inWindow(now: Date, s: SeasonalSeal): boolean {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  const a = s.from[0] * 100 + s.from[1];
  const b = s.to[0] * 100 + s.to[1];
  return a <= b ? md >= a && md <= b : md >= a || md <= b;  // 跨年窗
}

export function pickSeal(
  owned: ReadonlySet<string>,
  now: Date,
  rand: () => number = Math.random
): string {
  const seasonal = SEASONAL_SEALS.find(s => inWindow(now, s));
  if (seasonal) {
    if (!owned.has(seasonal.id)) return seasonal.id;   // 窗口内未拥有必得
    if (rand() < 0.5) return seasonal.id;              // 已拥有：一半再钤（×N）
  }
  return RESIDENT_SEALS[Math.floor(rand() * RESIDENT_SEALS.length)];
}

export interface SealRecord {
  seal_id: string;
  first_earned_at: string;
  first_store: string;
  first_item_count: number;
  times_earned: number;
}

export async function getSealCollection(accountId: string): Promise<SealRecord[]> {
  const { data, error } = await supabase
    .from('seal_collection')
    .select('seal_id, first_earned_at, first_store, first_item_count, times_earned')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data ?? []) as SealRecord[];
}

/** 钤一枚：已有则 times+1（首钤三件套不动——回忆永远是第一次），否则插入。 */
export async function awardSeal(
  accountId: string, sealId: string, store: string, itemCount: number
): Promise<{ record: SealRecord; isFirst: boolean }> {
  const { data: existing, error: exErr } = await supabase
    .from('seal_collection')
    .select('times_earned').eq('account_id', accountId).eq('seal_id', sealId).maybeSingle();
  if (exErr) throw exErr;
  if (existing) {
    const { data, error } = await supabase
      .from('seal_collection')
      .update({ times_earned: existing.times_earned + 1 })
      .eq('account_id', accountId).eq('seal_id', sealId)
      .select().single();
    if (error) throw error;
    return { record: data as SealRecord, isFirst: false };
  }
  const { data, error } = await supabase
    .from('seal_collection')
    .insert({ account_id: accountId, seal_id: sealId, first_store: store, first_item_count: itemCount, times_earned: 1 })
    .select().single();
  if (error) throw error;
  return { record: data as SealRecord, isFirst: true };
}
