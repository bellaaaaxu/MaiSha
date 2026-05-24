interface Props {
  open: boolean;
  supermarketName: string;
  totalCount: number;
  boughtCount: number;
  missedCount: number;
  listId: string;
  supermarketId: string;
  items: import('@/types/item').Item[];
  onClose: () => void;
  onDone: () => void;
}

export function ShoppingEndModal({ open }: Props) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
    <div className="bg-white rounded-3xl p-7 text-center mx-6">Placeholder — Task 4</div>
  </div>;
}
