import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { formatAmount, getOrDetectCurrency } from '@/utils/currency';

export default function PurchaseHistory() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { history, loading } = usePurchaseHistory(list?.id ?? null);

  const spending = useMemo(() => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let week = 0, month = 0, total = 0;
    let count = 0;
    for (const h of history) {
      if (h.amount == null) continue;
      const d = new Date(h.completed_at);
      total += h.amount;
      count++;
      if (d >= thisMonthStart) month += h.amount;
      if (d >= thisWeekStart) week += h.amount;
    }
    return { week, month, total, count };
  }, [history]);

  const currency = getOrDetectCurrency();

  return (
    <div className="min-h-screen page-enter" style={{ background: '#faf6f0' }}>
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10"
        style={{
          background: 'rgba(250,246,240,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
        <span className="flex-1 text-center text-base font-semibold" style={{ color: '#5a4e3c' }}>购物历史</span>
        <span className="w-10" />
      </header>

      <main className="p-4">
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#a0937e' }}>加载中…</div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm" style={{ color: '#a0937e' }}>还没有购物记录</div>
            <div className="text-xs mt-1" style={{ color: '#c4b49a' }}>完成一次购物后会自动记录~</div>
          </div>
        ) : (
          <>
            {spending.count > 0 && (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: 'rgba(124,169,130,0.08)', border: '1px solid rgba(124,169,130,0.2)' }}
              >
                <div className="text-xs font-medium mb-2.5" style={{ color: '#7a6e5d' }}>消费统计</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px]" style={{ color: '#a0937e' }}>本周</div>
                    <div className="text-lg font-bold" style={{ color: '#5a4e3c' }}>
                      {formatAmount(spending.week, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: '#a0937e' }}>本月</div>
                    <div className="text-lg font-bold" style={{ color: '#5a4e3c' }}>
                      {formatAmount(spending.month, currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => nav(`/history/${h.id}`)}
                  className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
                  style={{
                    background: 'rgba(255,252,247,0.6)',
                    border: '1px solid rgba(215,205,188,0.35)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
                      {h.supermarket_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {h.amount != null && (
                        <span className="text-sm font-semibold" style={{ color: '#c97b63' }}>
                          {formatAmount(h.amount, currency)}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#c4b49a' }}>
                        {new Date(h.completed_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs" style={{ color: '#a0937e' }}>
                    共 {h.total_count} 样 · 买了 {h.bought_count} 样
                    {h.total_count - h.bought_count > 0 && (
                      <span> · 漏了 {h.total_count - h.bought_count} 样</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
