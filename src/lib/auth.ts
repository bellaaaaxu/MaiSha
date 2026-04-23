import { supabase } from './supabase';

export async function getOrCreateAnonymousSession(): Promise<string> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error('Anonymous sign-in failed: ' + error?.message);
  }
  return data.user.id;
}

export async function getCurrentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
