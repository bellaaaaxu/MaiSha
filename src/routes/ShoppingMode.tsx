// src/routes/ShoppingMode.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';

export default function ShoppingMode() {
  const { marketId } = useParams<{ marketId: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);
  // customIconMap and uncategorizedItems will be used in Task 3
  useCustomIcons(list?.id ?? null);

  const supermarket = list?.supermarkets.find(s => s.id === marketId);
  const marketItems = items.filter(i => i.supermarket === marketId);

  if (!supermarket || !list) {
    return <div className="p-8 text-center" style={{ color: '#a0937e' }}>加载中…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf6f0' }}>
      <div className="p-4 text-center" style={{ color: '#5a4e3c' }}>
        Shopping Mode: {supermarket.name} — {marketItems.length} 件物品
      </div>
      <button onClick={() => nav(-1)} className="ml-4 text-sm" style={{ color: '#999' }}>
        ← 返回
      </button>
    </div>
  );
}
