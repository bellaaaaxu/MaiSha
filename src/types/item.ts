export interface Item {
  id: string;
  list_id: string;
  name: string;
  note: string;
  quantity: string;
  supermarket: string;      // DB column name unchanged
  category: string;         // keep for backward compat, stop writing new values
  category_emoji: string;   // keep for backward compat, stop writing new values
  checked: boolean;
  checked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type NewItemInput = Pick<Item, 'name'> &
  Partial<Pick<Item, 'note' | 'quantity' | 'supermarket'>>;
