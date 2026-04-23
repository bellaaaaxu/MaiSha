export type CategoryKey =
  | '蔬菜' | '水果' | '肉蛋' | '乳制品' | '主食'
  | '烘焙' | '调料' | '零食' | '饮料' | '日用' | '其他';

export interface Item {
  id: string;
  list_id: string;
  name: string;
  note: string;
  quantity: string;
  supermarket: string;
  category: CategoryKey;
  category_emoji: string;
  checked: boolean;
  checked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type NewItemInput = Pick<Item, 'name'> &
  Partial<Pick<Item, 'note' | 'quantity' | 'supermarket' | 'category' | 'category_emoji'>>;
