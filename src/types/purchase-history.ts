import type { Item } from './item';

export type HistoryItemSnapshot = Pick<Item, 'name' | 'quantity' | 'note' | 'category' | 'category_emoji' | 'checked'>;

export interface PurchaseHistory {
  id: string;
  list_id: string;
  supermarket_id: string;
  supermarket_name: string;
  items_snapshot: HistoryItemSnapshot[];
  total_count: number;
  bought_count: number;
  completed_at: string;
}
