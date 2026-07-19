import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCachedAccount } from '@/lib/active-list';
import { getSealCollection, RESIDENT_SEALS, SEASONAL_SEALS, type SealRecord } from '@/lib/seals';
import { SealImprint } from '@/components/SealImprint';

const ALL_SEALS = [...SEASONAL_SEALS.map(s => s.id), ...RESIDENT_SEALS];

export default function SealBook() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [records, setRecords] = useState<Map<string, SealRecord>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);  // 点空印记 → 轻微晃动(未解锁反馈)
  const [shown, setShown] = useState(0);          // count-up
  const earnedCount = records.size;

  useEffect(() => {
    const account = getCachedAccount();
    if (!account) { setLoaded(true); return; }
    getSealCollection(account.id)
      .then(rs => setRecords(new Map(rs.map(r => [r.seal_id, r]))))
      .catch(() => { /* 读失败当空集章本,不挡页面 */ })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {                                // 数字滚动:0 → earnedCount
    if (!loaded) return;
    let i = 0;
    const timer = setInterval(() => { i++; setShown(Math.min(i, earnedCount)); if (i >= earnedCount) clearInterval(timer); }, 80);
    if (earnedCount === 0) { setShown(0); clearInterval(timer); }
    return () => clearInterval(timer);
  }, [loaded, earnedCount]);

  return (
    <div className="min-h-screen px-5 pt-5 pb-10" style={{ background: 'var(--paper)' }}>
      <style>{`@keyframes sealShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }`}</style>
      <div className="flex items-center mb-1">
        <button onClick={() => nav(-1)} aria-label={t('common.back')} className="text-2xl mr-2" style={{ color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 24, color: 'var(--ink)' }}>{t('seals.title')}</span>
      </div>
      <div className="text-sm mb-5" style={{ color: 'var(--ink-light)' }}>{t('seals.progress', { n: shown, total: ALL_SEALS.length })}</div>
      <div className="grid grid-cols-3 gap-4">
        {ALL_SEALS.map((id, idx) => {
          const rec = records.get(id);
          const isFlipped = flipped === id;
          const seasonal = SEASONAL_SEALS.some(s => s.id === id);
          return (
            <button key={id} type="button"
              style={{
                perspective: 600, opacity: loaded ? 1 : 0, transition: 'opacity .4s', transitionDelay: `${idx * 50}ms`,
                animation: shaking === id ? 'sealShake .4s' : undefined,
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'inherit', font: 'inherit',
              }}
              onClick={() => rec
                ? setFlipped(isFlipped ? null : id)
                : (setShaking(id), setTimeout(() => setShaking(null), 400))}>
              <div style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform .5s', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div className="flex flex-col items-center gap-1 p-3 rounded-2xl" style={{ background: '#fffdf7', border: '1px solid #ece3d2', backfaceVisibility: 'hidden' }}>
                  <SealImprint sealId={id} size={64} empty={!rec} rotate={rec ? -6 : 0} />
                  <span className="text-xs" style={{ color: rec ? 'var(--ink)' : 'var(--ink-faint)' }}>{t(`seals.name.${id}`)}</span>
                  {rec && rec.times_earned > 1 && <span className="text-[10px]" style={{ color: '#B0442C' }}>×{rec.times_earned}</span>}
                  {!rec && seasonal && <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>{t(`seals.locked.${id}`)}</span>}
                </div>
                {rec && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 rounded-2xl text-center"
                    style={{ background: '#f6efe3', border: '1px solid #ece3d2', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--ink)' }}>
                      {/* date-format.ts 只有 formatRelativeDate("3天前" 相对式)，首钤回忆要绝对日期，故内联 toLocaleDateString */}
                      {t('seals.firstMemory', { date: new Date(rec.first_earned_at).toLocaleDateString(), store: rec.first_store, count: rec.first_item_count })}
                    </span>
                    {rec.times_earned > 1 && <span className="text-[10px]" style={{ color: '#B0442C' }}>×{rec.times_earned}</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
