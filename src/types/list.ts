import type { Store } from './store';

export type ListState = 'active' | 'pinned' | 'archived';

export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Store[];  // DB column name unchanged
  short_code: string;
  account_id: string;
  state: ListState;
  pin_order: number | null;
  created_at: string;
  updated_at: string;
}
