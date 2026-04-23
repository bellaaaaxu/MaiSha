import type { Item } from '@/types/item';

interface Props {
  item: Item | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onDuplicate: (item: Item) => void;
}

export function ItemMenu({ item, onClose, onEdit, onDelete, onDuplicate }: Props) {
  if (!item) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-2xl pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-3 text-center text-sm text-gray-500 border-b border-gray-100">
          {item.name}
        </div>
        <button
          onClick={() => { onEdit(item); onClose(); }}
          className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
        >
          编辑
        </button>
        <button
          onClick={() => { onDuplicate(item); onClose(); }}
          className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
        >
          复制到下次
        </button>
        <button
          onClick={() => { onDelete(item); onClose(); }}
          className="w-full py-4 text-center text-sm text-danger active:bg-gray-50"
        >
          删除
        </button>
        <button
          onClick={onClose}
          className="w-full py-4 text-center text-sm text-gray-500 mt-2 bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
