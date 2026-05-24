export interface HistoryItemSnapshot {
  name: string;
  quantity: string;
  note: string;
  category: string;
  category_emoji: string;
  checked: boolean;
}

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
