import { supabase } from './supabase';
import type { Item } from '@/types/item';

export function subscribeItems(
  listId: string,
  onSnapshot: (items: Item[]) => void,
  initial: Item[]
): () => void {
  let current = initial.slice();
  const channel = supabase
    .channel(`items-${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          current = [...current, payload.new as Item];
        } else if (payload.eventType === 'UPDATE') {
          current = current.map(i => (i.id === (payload.new as Item).id ? (payload.new as Item) : i));
        } else if (payload.eventType === 'DELETE') {
          current = current.filter(i => i.id !== (payload.old as Item).id);
        }
        onSnapshot(current);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
