import type { Supermarket } from './supermarket';

export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Supermarket[];
  created_at: string;
  updated_at: string;
}
