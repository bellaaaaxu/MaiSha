import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveCurrency, getAllCurrencies, getOrDetectCurrency } from '@/utils/currency';

const HOUSEHOLD_OPTIONS = [
  { key: '1', emoji: '🧑', label: '一个人' },
  { key: '2', emoji: '👫', label: '两个人' },
  { key: 'family', emoji: '👨‍👩‍👧', label: '一家人' },
];

const SUPERMARKET_PRESETS = [
  { id: 'tnt', name: 'T&T 大统华', emoji: '🥬' },
  { id: 'costco', name: 'Costco', emoji: '🏬' },
  { id: 'walmart', name: 'Walmart', emoji: '🛒' },
  { id: 'hema', name: '盒马', emoji: '🐴' },
  { id: 'sam', name: "Sam's Club", emoji: '🏪' },
  { id: 'yc', name: '元初', emoji: '🛒' },
];

const POPULAR_CURRENCIES = ['CNY', 'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'HKD', 'TWD', 'SGD'];

const TOTAL_STEPS = 5;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            background: i === current ? '#7ca982' : i < current ? '#b8d4bc' : '#e0d6c6',
          }}
        />
      ))}
    </div>
  );
}

function CardOption({
  selected,
  onClick,
  children,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.97]"
      style={{
        background: selected ? 'rgba(124,169,130,0.12)' : 'rgba(255,252,247,0.6)',
        border: selected ? '2px solid #7ca982' : '2px solid rgba(215,205,188,0.3)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [household, setHousehold] = useState('2');
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set(['tnt', 'costco']));
  const [customMarket, setCustomMarket] = useState('');
  const [trackQty, setTrackQty] = useState(false);
  const detectedCurrency = getOrDetectCurrency();
  const [currencyCode, setCurrencyCode] = useState(detectedCurrency.code);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const goNext = () => {
    if (step >= TOTAL_STEPS - 1) return finish();
    setDirection('forward');
    setStep(s => s + 1);
  };

  const goBack = () => {
    setDirection('back');
    setStep(s => Math.max(0, s - 1));
  };

  const toggleMarket = (id: string) => {
    setSelectedMarkets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addCustomMarket = () => {
    const name = customMarket.trim();
    if (!name) return;
    const id = `custom-${name}`;
    SUPERMARKET_PRESETS.push({ id, name, emoji: '🛒' });
    setSelectedMarkets(prev => new Set(prev).add(id));
    setCustomMarket('');
  };

  const finish = () => {
    localStorage.setItem('maisha:household', household);
    localStorage.setItem('maisha:track-qty', trackQty ? '1' : '0');
    saveCurrency(currencyCode);

    const supermarkets = [
      ...SUPERMARKET_PRESETS.filter(s => selectedMarkets.has(s.id)),
      { id: 'none', name: '未分类', emoji: '❓' },
    ];
    localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(supermarkets));
    localStorage.setItem('maisha:seen', '1');
    nav('/list');
  };

  const animClass = direction === 'forward' ? 'animate-step-forward' : 'animate-step-back';

  return (
    <div
      className="min-h-screen flex flex-col px-6 py-10"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      {step > 0 && (
        <button
          onClick={goBack}
          className="self-start text-sm mb-4 active:opacity-60"
          style={{ color: '#a0937e' }}
        >
          ← 上一步
        </button>
      )}

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <StepDots current={step} total={TOTAL_STEPS} />

        <div key={step} className={animClass}>
          {step === 0 && (
            <div className="text-center">
              <div className="text-6xl mb-5" style={{ animation: 'floatBounce 2s ease-in-out infinite' }}>🛒</div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: '#5a4e3c' }}>买啥 MaiSha</h1>
              <p className="text-sm mb-10" style={{ color: '#a0937e' }}>
                和 TA 共享的购物清单
              </p>
              <div className="space-y-2.5 mb-10 text-left">
                {[
                  { emoji: '📝', text: '想到要买的随手加' },
                  { emoji: '🏪', text: '按超市分组，到店不慌' },
                  { emoji: '💚', text: '家人实时同步' },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3 text-sm flex items-center gap-3"
                    style={{
                      background: 'rgba(255,252,247,0.6)',
                      border: '1px solid rgba(215,205,188,0.3)',
                      color: '#5a4e3c',
                      animation: `fadeSlideUp 0.5s ease-out ${0.2 + i * 0.15}s both`,
                    }}
                  >
                    <span className="text-lg">{f.emoji}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👋</div>
                <h2 className="text-lg font-bold" style={{ color: '#5a4e3c' }}>你的菜篮子几个人用？</h2>
                <p className="text-xs mt-1" style={{ color: '#a0937e' }}>帮你优化推荐</p>
              </div>
              <div className="space-y-3">
                {HOUSEHOLD_OPTIONS.map((opt, i) => (
                  <CardOption
                    key={opt.key}
                    selected={household === opt.key}
                    onClick={() => setHousehold(opt.key)}
                    style={{ animation: `fadeSlideUp 0.4s ease-out ${i * 0.1}s both` }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{opt.emoji}</span>
                      <span className="text-sm font-medium" style={{ color: '#5a4e3c' }}>{opt.label}</span>
                      {household === opt.key && (
                        <span className="ml-auto text-sm" style={{ color: '#7ca982' }}>✓</span>
                      )}
                    </div>
                  </CardOption>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🏪</div>
                <h2 className="text-lg font-bold" style={{ color: '#5a4e3c' }}>你常去哪些超市？</h2>
                <p className="text-xs mt-1" style={{ color: '#a0937e' }}>可多选，之后还能改</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {SUPERMARKET_PRESETS.map((s, i) => (
                  <CardOption
                    key={s.id}
                    selected={selectedMarkets.has(s.id)}
                    onClick={() => toggleMarket(s.id)}
                    style={{ animation: `fadeSlideUp 0.35s ease-out ${i * 0.06}s both` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{s.emoji}</span>
                      <span className="text-xs font-medium truncate" style={{ color: '#5a4e3c' }}>{s.name}</span>
                    </div>
                  </CardOption>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={customMarket}
                  onChange={e => setCustomMarket(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCustomMarket(); }}
                  placeholder="其他超市..."
                  className="flex-1 text-sm rounded-xl px-3 py-2.5 outline-none"
                  style={{
                    background: 'rgba(255,252,247,0.6)',
                    border: '1px solid rgba(215,205,188,0.3)',
                    color: '#5a4e3c',
                  }}
                />
                {customMarket.trim() && (
                  <button
                    onClick={addCustomMarket}
                    className="shrink-0 px-3 rounded-xl text-xs font-medium text-white active:opacity-80"
                    style={{ background: '#7ca982' }}
                  >
                    添加
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📏</div>
                <h2 className="text-lg font-bold" style={{ color: '#5a4e3c' }}>需要记录数量吗？</h2>
                <p className="text-xs mt-1" style={{ color: '#a0937e' }}>比如「牛奶 × 2盒」</p>
              </div>
              <div className="space-y-3">
                <CardOption
                  selected={!trackQty}
                  onClick={() => setTrackQty(false)}
                  style={{ animation: 'fadeSlideUp 0.4s ease-out both' }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🎯</span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#5a4e3c' }}>只选种类</div>
                      <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>轻松简单，点一下就加</div>
                    </div>
                    {!trackQty && <span className="ml-auto text-sm" style={{ color: '#7ca982' }}>✓</span>}
                  </div>
                </CardOption>
                <CardOption
                  selected={trackQty}
                  onClick={() => setTrackQty(true)}
                  style={{ animation: 'fadeSlideUp 0.4s ease-out 0.1s both' }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">📝</span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#5a4e3c' }}>记录数量</div>
                      <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>精确管理，适合大采购</div>
                    </div>
                    {trackQty && <span className="ml-auto text-sm" style={{ color: '#7ca982' }}>✓</span>}
                  </div>
                </CardOption>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">💰</div>
                <h2 className="text-lg font-bold" style={{ color: '#5a4e3c' }}>你的货币</h2>
                <p className="text-xs mt-1" style={{ color: '#a0937e' }}>用于记录购物花费</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {getAllCurrencies()
                  .filter(c => POPULAR_CURRENCIES.includes(c.code))
                  .map((c, i) => (
                    <CardOption
                      key={c.code}
                      selected={currencyCode === c.code}
                      onClick={() => setCurrencyCode(c.code)}
                      style={{ animation: `fadeSlideUp 0.35s ease-out ${i * 0.05}s both` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold" style={{ color: '#5a4e3c' }}>{c.symbol}</div>
                          <div className="text-[10px]" style={{ color: '#a0937e' }}>{c.code}</div>
                        </div>
                        {currencyCode === c.code && (
                          <span className="text-sm" style={{ color: '#7ca982' }}>✓</span>
                        )}
                      </div>
                    </CardOption>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="max-w-sm mx-auto w-full space-y-3 pt-6">
        <button
          onClick={goNext}
          className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90 transition-all"
          style={{ background: '#7ca982' }}
        >
          {step === 0 ? '开始设置' : step === TOTAL_STEPS - 1 ? '开始使用 🎉' : '下一步'}
        </button>
        {step === 0 && (
          <button
            onClick={() => nav('/join')}
            className="w-full h-10 rounded-xl font-medium text-sm active:opacity-70"
            style={{ color: '#7ca982', border: '1px solid rgba(124,169,130,0.3)' }}
          >
            🔑 有邀请码？加入清单
          </button>
        )}
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <button
            onClick={finish}
            className="w-full text-xs py-2 active:opacity-60"
            style={{ color: '#c4b49a' }}
          >
            跳过，直接开始
          </button>
        )}
      </div>
    </div>
  );
}
