import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { savePurchaseHistory } from '@/lib/purchase-history';
import { track } from '@/lib/analytics';
import { getOrDetectCurrency, getSavedCurrency, saveCurrency, getAllCurrencies, type CurrencyConfig } from '@/utils/currency';
import { getCachedAccount } from '@/lib/active-list';
import { pickSeal, getSealCollection, awardSeal } from '@/lib/seals';
import { SealImprint } from '@/components/SealImprint';
import type { Item } from '@/types/item';
import type { HistoryItemSnapshot } from '@/types/purchase-history';

interface Props {
  open: boolean;
  supermarketName: string;
  totalCount: number;
  boughtCount: number;
  missedCount: number;
  listId: string;
  supermarketId: string;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}

const CELEBRATIONS = [
  { emoji: '🎉', text: '辛苦啦，今天的菜齐了！' },
  { emoji: '🌟', text: '太棒了，全部搞定！' },
  { emoji: '🛍️', text: '完美采购，一样不少！' },
  { emoji: '✨', text: '效率满分，回家做饭咯！' },
];

export function ShoppingEndModal({
  open, supermarketName, totalCount: _totalCount, boughtCount: _boughtCount, missedCount,
  listId, supermarketId, items, onClose, onDone,
}: Props) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<CurrencyConfig>(getOrDetectCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(!getSavedCurrency());
  const [earned, setEarned] = useState<{ sealId: string; isFirst: boolean; times: number } | null>(null);
  const allDone = missedCount === 0;

  useEffect(() => { if (open) { setEarned(null); setSaving(false); } }, [open]);
  const celebration = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];

  if (!open) return null;

  if (earned) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(40,30,20,.5)', zIndex: 1000 }}>
        <div className="mx-6 w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: 'linear-gradient(180deg,#faf6f0,#f3ede4)', border: '1px solid rgba(215,205,188,.5)' }}>
          <style>{`
            @keyframes sealDrop { 0%{opacity:0;transform:translateY(-110px) scale(2) rotate(-20deg)} 55%{opacity:1;transform:translateY(0) scale(.92) rotate(-3deg)} 70%{transform:scale(1.06) rotate(-8deg)} 100%{transform:scale(1) rotate(-6deg)} }
            @keyframes sealFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          `}</style>
          <div style={{ animation: 'sealDrop 1s cubic-bezier(.22,.68,.28,1) forwards', display: 'inline-block' }}>
            <SealImprint sealId={earned.sealId} size={120} rotate={0} />
          </div>
          <div style={{ opacity: 0, animation: 'sealFade .5s ease-out .9s forwards' }}>
            <div className="mt-3 text-sm" style={{ color: '#7a6e58' }}>{t('seals.earned')}</div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 26, color: '#5a4e3c' }}>{t(`seals.name.${earned.sealId}`)}</div>
            <div className="text-xs" style={{ color: '#b0a48d' }}>{earned.isFirst ? t('seals.firstTime') : t('seals.timesEarned', { count: earned.times })}</div>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 h-11 rounded-xl text-white text-sm" style={{ background: '#7ca982' }}
                onClick={() => {
                  // 不走 onDone：其 nav(-1) 与本处 push 是两个竞态的异步 history 操作，
                  // 会把 /seals 覆盖掉（e2e 实测落回 /list）。replace 掉当前购物页，
                  // 从集章本返回时自然回到清单。
                  setEarned(null);
                  onClose();
                  nav('/seals', { replace: true });
                }}>{t('seals.toBook')}</button>
              <button className="flex-1 h-11 rounded-xl text-sm" style={{ background: '#f0e7d8', color: '#7a6e58' }}
                onClick={() => { setEarned(null); onDone(); }}>{t('common.ok')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectCurrency = (c: CurrencyConfig) => {
    setCurrency(c);
    saveCurrency(c.code);
    setShowCurrencyPicker(false);
  };

  const saveAndClose = async (_clearMissed: boolean) => {
    setSaving(true);
    let snapshot: HistoryItemSnapshot[];
    try {
      snapshot = items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        note: i.note,
        category: i.category,
        category_emoji: i.category_emoji,
        checked: i.checked,
      }));
      const amount = amountStr ? parseFloat(amountStr) : null;
      await savePurchaseHistory(listId, supermarketId, supermarketName, snapshot, amount, currency.code);
      track('complete_trip', { listId, props: { items: snapshot.length, store: supermarketName } });
    } catch {
      alert('保存失败，请重试');
      setSaving(false);
      return;
    }
    try {
      const account = getCachedAccount();
      if (account) {
        const owned = new Set((await getSealCollection(account.id)).map(r => r.seal_id));
        const sealId = pickSeal(owned, new Date());
        const { record, isFirst } = await awardSeal(account.id, sealId, supermarketName, snapshot.filter(s => s.checked).length);
        setEarned({ sealId, isFirst, times: record.times_earned });
        setAmountStr('');
        setSaving(false);
        try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* web 降级 */ }
        return;  // 停在揭晓视图,onDone 交给揭晓按钮
      }
    } catch { /* 发章失败:宁缺毋滥,直接走完成 */ }
    setSaving(false);
    setAmountStr('');
    onDone();
  };

  const renderAmountInput = () => (
    <div className="mb-4">
      <div className="flex items-center rounded-xl overflow-hidden" style={{ background: '#f5f0ea', border: '1px solid rgba(215,205,188,0.4)' }}>
        <button
          onClick={() => setShowCurrencyPicker(true)}
          className="shrink-0 px-3 py-3 text-sm font-medium active:opacity-70"
          style={{ color: '#7a6e5d', borderRight: '1px solid rgba(215,205,188,0.4)' }}
        >
          {currency.symbol} ▾
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={amountStr}
          onChange={e => setAmountStr(e.target.value)}
          placeholder="本次花了多少？（选填）"
          className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
          style={{ color: '#5a4e3c' }}
        />
      </div>
      {showCurrencyPicker && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {getAllCurrencies().map(c => (
            <button
              key={c.code}
              onClick={() => selectCurrency(c)}
              className="px-2.5 py-1 rounded-full text-xs font-medium active:scale-95"
              style={{
                background: c.code === currency.code ? '#7ca982' : 'rgba(255,252,247,0.6)',
                color: c.code === currency.code ? '#fff' : '#5a4e3c',
                border: c.code === currency.code ? '1px solid #7ca982' : '1px solid rgba(215,205,188,0.4)',
              }}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div
        className="mx-6 w-full max-w-sm rounded-3xl p-7 text-center"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        {allDone ? (
          <>
            <div className="text-5xl mb-3 animate-celebration">{celebration.emoji}</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物完成</h3>
            <p className="text-sm mb-4" style={{ color: '#a0937e' }}>
              {celebration.text}
            </p>
            {renderAmountInput()}
            <button
              onClick={() => saveAndClose(false)}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#7ca982' }}
            >
              {saving ? '保存中…' : '返回清单'}
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🛍️</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物结束</h3>
            <p className="text-sm mb-4" style={{ color: '#a0937e' }}>
              还有 {missedCount} 件没买到
            </p>
            {renderAmountInput()}
            <div className="space-y-2.5">
              <button
                onClick={() => saveAndClose(false)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: '#7ca982' }}
              >
                {saving ? '保存中…' : '保留下次买'}
              </button>
              <button
                onClick={() => saveAndClose(true)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-medium text-sm"
                style={{ background: '#f5f0ea', color: '#5a4e3c' }}
              >
                全部清除
              </button>
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-4 text-xs"
          style={{ color: '#ccc' }}
        >
          继续购物
        </button>
      </div>
    </div>
  );
}
