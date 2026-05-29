import type { Store } from './store';

export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Store[];  // DB column name unchanged
  short_code: string;
  account_id: string;
  created_at: string;
  updated_at: string;
}
