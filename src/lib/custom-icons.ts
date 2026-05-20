// src/lib/custom-icons.ts
import { supabase } from './supabase';

export interface CustomIcon {
  id: string;
  list_id: string;
  name: string;
  image_path: string;
  source: 'upload' | 'ai_generated' | 'ai_stylized';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'custom-icons';

export function buildStoragePath(listId: string, iconId: string): string {
  return `${listId}/${iconId}.webp`;
}

export function getPublicIconUrl(imagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function fetchCustomIcons(listId: string): Promise<CustomIcon[]> {
  const { data, error } = await supabase
    .from('custom_icons')
    .select('*')
    .eq('list_id', listId);
  if (error) throw error;
  return (data ?? []) as CustomIcon[];
}

export async function findExistingIcon(listId: string, name: string): Promise<CustomIcon | null> {
  const { data, error } = await supabase
    .from('custom_icons')
    .select('*')
    .eq('list_id', listId)
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data as CustomIcon | null;
}

export async function uploadCustomIcon(
  listId: string,
  name: string,
  blob: Blob,
  source: CustomIcon['source'],
  createdBy: string
): Promise<CustomIcon> {
  const iconId = crypto.randomUUID();
  const storagePath = buildStoragePath(listId, iconId);

  const existing = await findExistingIcon(listId, name);
  if (existing) {
    await supabase.storage.from(BUCKET).remove([existing.image_path]);
  }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  const { data, error: dbErr } = await supabase
    .from('custom_icons')
    .upsert(
      {
        list_id: listId,
        name,
        image_path: storagePath,
        source,
        created_by: createdBy,
      },
      { onConflict: 'list_id,name' }
    )
    .select()
    .single();
  if (dbErr) throw dbErr;
  return data as CustomIcon;
}

export async function deleteCustomIcon(icon: CustomIcon): Promise<void> {
  await supabase.storage.from(BUCKET).remove([icon.image_path]);
  const { error } = await supabase
    .from('custom_icons')
    .delete()
    .eq('id', icon.id);
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
  if (referenceImageBase64) {
    body.reference_image = referenceImageBase64;
  }

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

export async function getRemainingCredits(userUid: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_generation_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_uid', userUid)
    .gte('created_at', today.toISOString());

  if (error) throw error;
  return Math.max(0, 5 - (count ?? 0));
}
