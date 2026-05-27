import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { deletePurchaseHistory } from '@/lib/purchase-history';
import { formatAmount, getOrDetectCurrency } from '@/utils/currency';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function PurchaseHistory() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { history, loading, refresh } = usePurchaseHistory(list?.id ?? null);

  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const allSelected = history.length > 0 && selected.size === history.length;

  const enterManage = () => {
    setManageMode(true);
    setSelected(new Set());
  };

  const exitManage = () => {
    setManageMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(history.map(h => h.id)));
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await deletePurchaseHistory(Array.from(selected));
      await refresh();
      exitManage();
    } catch {
      alert('删除失败');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const confirmMessage = selected.size === 1
    ? t('history.confirmDeleteOne')
    : t('history.confirmDeleteMany', { n: selected.size });

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
        {manageMode ? (
          <>
            <button onClick={exitManage} className="text-sm" style={{ color: '#a0937e' }}>
              {t('history.cancel')}
            </button>
            <span className="flex-1 text-center text-sm font-semibold" style={{ color: '#5a4e3c' }}>
              {t('history.selectedCount', { n: selected.size })}
            </span>
            <button onClick={toggleSelectAll} className="text-sm mr-3" style={{ color: '#7ca982' }}>
              {allSelected ? t('history.deselectAll') : t('history.selectAll')}
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold"
              style={{
                color: selected.size === 0 ? '#d5cbbe' : '#c97b63',
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              {t('history.delete')}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
            <span className="flex-1 text-center text-base font-semibold" style={{ color: '#5a4e3c' }}>购物历史</span>
            {history.length > 0 ? (
              <button onClick={enterManage} className="text-sm" style={{ color: '#7ca982' }}>
                {t('history.manage')}
              </button>
            ) : (
              <span className="w-10" />
            )}
          </>
        )}
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
            {!manageMode && spending.count > 0 && (
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
              {history.map(h => {
                const isSelected = selected.has(h.id);
                return (
                  <button
                    key={h.id}
                    onClick={() => manageMode ? toggleSelect(h.id) : nav(`/history/${h.id}`)}
                    className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-transform flex items-center gap-3"
                    style={{
                      background: isSelected ? 'rgba(124,169,130,0.08)' : 'rgba(255,252,247,0.6)',
                      border: isSelected ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                    }}
                  >
                    {manageMode && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected ? '#7ca982' : 'transparent',
                          border: isSelected ? 'none' : '2px solid #d5cbbe',
                        }}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
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
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      <ConfirmModal
        open={confirmOpen}
        title={t('history.delete')}
        message={confirmMessage}
        confirmText={deleting ? '删除中…' : t('history.delete')}
        cancelText={t('history.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
