// src/lib/custom-icons.ts — account-scoped icon library data layer.
import { supabase } from './supabase';
import { buildIconMap, type IconMapRow } from './icon-map';

export interface CustomIcon {
  id: string;
  account_id: string;
  name: string;
  image_path: string;
  source: 'upload' | 'ai_generated' | 'ai_stylized';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'custom-icons';
const PER_ACCOUNT_DAILY = 5;

export function buildStoragePath(accountId: string, iconId: string): string {
  return `${accountId}/${iconId}.webp`;
}

export function getPublicIconUrl(imagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

/** Union map for a list: all members' accounts' libraries + this list's assignments. */
export async function fetchListIconMap(listId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('get_list_icon_map', { p_list_id: listId });
  if (error) throw error;
  return buildIconMap((data ?? []) as IconMapRow[], getPublicIconUrl);
}

/** The current account's own library (management page). */
export async function fetchMyLibrary(accountId: string): Promise<CustomIcon[]> {
  const { data, error } = await supabase
    .from('icon_library')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomIcon[];
}

export async function findExistingIcon(accountId: string, name: string): Promise<CustomIcon | null> {
  const { data, error } = await supabase
    .from('icon_library')
    .select('*')
    .eq('account_id', accountId)
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data as CustomIcon | null;
}

export async function uploadCustomIcon(
  accountId: string,
  name: string,
  blob: Blob,
  source: CustomIcon['source'],
  createdBy: string
): Promise<CustomIcon> {
  const iconId = crypto.randomUUID();
  const storagePath = buildStoragePath(accountId, iconId);

  const existing = await findExistingIcon(accountId, name);
  if (existing) {
    await supabase.storage.from(BUCKET).remove([existing.image_path]);
  }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/webp', upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: dbErr } = await supabase
    .from('icon_library')
    .upsert(
      { account_id: accountId, name, image_path: storagePath, source, created_by: createdBy },
      { onConflict: 'account_id,name' }
    )
    .select()
    .single();
  if (dbErr) throw dbErr;
  return data as CustomIcon;
}

export async function deleteCustomIcon(icon: CustomIcon): Promise<void> {
  await supabase.storage.from(BUCKET).remove([icon.image_path]);
  const { error } = await supabase.from('icon_library').delete().eq('id', icon.id);
  if (error) throw error;
}

export async function generateIcon(
  name: string,
  listId: string,
  referenceImageBase64?: string
): Promise<{ image_url: string; remaining_today: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const body: Record<string, string> = { name, list_id: listId };
  if (referenceImageBase64) body.reference_image = referenceImageBase64;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-icon`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (response.status === 429) {
    const err = await response.json();
    throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT', ...err });
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || 'Generation failed'), { code: 'GENERATION_FAILED' });
  }
  return response.json();
}

/** Remaining per-account daily generations (display only; server enforces the graduated gate). */
export async function getRemainingCredits(accountId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('ai_generation_log')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', today.toISOString());
  if (error) throw error;
  return Math.max(0, PER_ACCOUNT_DAILY - (count ?? 0));
}

export interface ReusableIcon {
  id: string;
  name: string;
  image_path: string;
}

/** Union of all list members' custom icons (with ids), for the reuse selector. */
export async function fetchReusableIcons(listId: string): Promise<ReusableIcon[]> {
  const { data, error } = await supabase.rpc('get_reusable_icons', { p_list_id: listId });
  if (error) throw error;
  return (data ?? []) as ReusableIcon[];
}

/** Pin (list, name) -> icon for this list (cross-name reuse). Upsert: re-pinning replaces. */
export async function setListIconAssignment(
  listId: string,
  name: string,
  iconId: string,
  setBy: string
): Promise<void> {
  const { error } = await supabase
    .from('list_icon_assignments')
    .upsert(
      { list_id: listId, name, icon_id: iconId, set_by: setBy },
      { onConflict: 'list_id,name' }
    );
  if (error) throw error;
}
