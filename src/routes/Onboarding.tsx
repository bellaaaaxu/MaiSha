import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { saveCurrency, getAllCurrencies, getOrDetectCurrency } from '@/utils/currency';
import Wordmark from '@/components/Wordmark';
import WashiTape from '@/components/WashiTape';
import { StorePicker } from '@/components/StorePicker';
import type { Store } from '@/types/store';

const POPULAR_CURRENCIES = ['CNY', 'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'HKD', 'TWD', 'SGD'];

const TOTAL_STEPS = 3;

const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"), linear-gradient(180deg, var(--paper) 0%, #F7F0E6 100%)`;

export default function Onboarding() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language || 'zh-CN');
  const [addedStores, setAddedStores] = useState<Store[]>([]);
  const detectedCurrency = getOrDetectCurrency();
  const [currencyCode, setCurrencyCode] = useState(detectedCurrency.code);
  const [finishing, setFinishing] = useState(false);
  const finishTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
      }
    };
  }, []);

  const goNext = () => {
    if (step >= TOTAL_STEPS - 1) return finish();
    setStep(s => s + 1);
  };

  const goBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  const finish = () => {
    setFinishing(true);
    saveCurrency(currencyCode);
    const stores: Store[] = [
      ...addedStores,
      { id: 'none', name: t('addSheet.noStore') },
    ];
    localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(stores));
    localStorage.setItem('maisha:language', language);
    localStorage.setItem('maisha:seen', '1');
    finishTimerRef.current = window.setTimeout(() => nav('/list'), 600);
  };

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        background: 'var(--paper)',
        backgroundImage: PAPER_TEXTURE,
      }}
    >
      {/* Back button */}
      {step > 0 && (
        <button
          onClick={goBack}
          style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--ink-light)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 8,
            padding: 0,
          }}
        >
          ← {t('shopping.back')}
        </button>
      )}

      {/* Step indicator: dashed-line journal style */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          marginBottom: 32,
          marginTop: step === 0 ? 8 : 0,
        }}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 32 : 16,
              height: 3,
              background: i <= step ? 'var(--accent-soft)' : 'var(--ink-faint)',
              borderRadius: 2,
              opacity: i <= step ? 0.8 : 0.3,
              transform: i === step ? 'rotate(-0.3deg)' : 'none',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {/* Step content area — top-aligned, not centered */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          maxWidth: 360,
          margin: '0 auto',
          width: '100%',
          paddingTop: 8,
        }}
      >
        {step === 0 && <Step0Language language={language} setLanguage={setLanguage} />}
        {step === 1 && (
          <Step1Stores
            addedStores={addedStores}
            setAddedStores={setAddedStores}
          />
        )}
        {step === 2 && <Step2Currency currencyCode={currencyCode} setCurrencyCode={setCurrencyCode} />}
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          maxWidth: 360,
          margin: '0 auto',
          width: '100%',
          paddingTop: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <button
          onClick={goNext}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            color: 'white',
            background: 'var(--green)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(123, 163, 126, 0.25)',
          }}
        >
          {step === TOTAL_STEPS - 1 ? t('onboarding.done') : t('onboarding.next')}
        </button>
        {step === 1 && (
          <button
            onClick={finish}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ink-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            {t('onboarding.skip')}
          </button>
        )}
        {step === 0 && (
          <button
            onClick={() => nav('/join?mode=recover')}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ink-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            已经用过买啥？输入找回码恢复清单
          </button>
        )}
      </div>

      {finishing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(251, 246, 239, 0.92)',
            zIndex: 40,
            animation: 'inkSpread 0.5s ease-out',
          }}
        >
          <WashiTape
            src="/decorations/washi-blue-botanical.webp"
            width={240}
            rotation={-3}
            opacity={0.95}
          />
        </div>
      )}
    </div>
  );
}

// Placeholder step components — replaced in Tasks 5/6/7
function Step0Language({ language, setLanguage }: { language: string; setLanguage: (l: string) => void }) {
  const { i18n } = useTranslation();
  return (
    <div>
      {/* Washi tape decoration above wordmark */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <WashiTape
          src="/decorations/washi-sage-botanical.webp"
          width={120}
          rotation={-3}
          opacity={0.85}
          style={{ marginLeft: -40 }}
        />
      </div>
      <Wordmark variant="hero" />
      <div style={{ marginTop: 40 }}>
        {[
          { code: 'zh-CN', label: '简体中文' },
          { code: 'zh-TW', label: '繁體中文' },
          { code: 'en', label: 'English' },
        ].map(lang => (
          <button
            key={lang.code}
            onClick={() => {
              i18n.changeLanguage(lang.code);
              setLanguage(lang.code);
            }}
            aria-pressed={language === lang.code}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              padding: '14px 20px',
              marginBottom: 12,
              borderRadius: 14,
              border: 'none',
              background: language === lang.code ? 'rgba(212, 131, 107, 0.08)' : 'white',
              color: 'var(--ink)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow:
                language === lang.code
                  ? 'inset 4px 0 0 0 var(--accent), 0 2px 8px rgba(74, 55, 40, 0.06)'
                  : '0 2px 8px rgba(74, 55, 40, 0.06)',
            }}
          >
            <span>{lang.label}</span>
            {language === lang.code && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step1Stores({
  addedStores,
  setAddedStores,
}: {
  addedStores: Store[];
  setAddedStores: (stores: Store[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <Wordmark variant="mini" />

      {/* Step title area: washi tape + title + underline */}
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <WashiTape
            src="/decorations/washi-coral.webp"
            width={100}
            rotation={-3}
            opacity={0.85}
            style={{ marginRight: -40 }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--ink)',
            letterSpacing: 2,
            display: 'inline-block',
            position: 'relative',
            margin: 0,
          }}
        >
          {t('onboarding.addStores')}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -4,
              height: 3,
              background: 'var(--accent-soft)',
              borderRadius: 2,
              transform: 'rotate(-0.5deg)',
              opacity: 0.7,
            }}
          />
        </h2>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--ink-light)',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        {t('onboarding.addStoresHint')}
      </p>

      <StorePicker
        stores={addedStores}
        onChange={setAddedStores}
        placeholder={t('onboarding.storePlaceholder')}
      />
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--ink-faint)',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        {t('onboarding.addStoreHelper')}
      </p>
    </div>
  );
}

function Step2Currency({
  currencyCode,
  setCurrencyCode,
}: {
  currencyCode: string;
  setCurrencyCode: (c: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Wordmark variant="mini" />

      <div style={{ position: 'relative', textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <WashiTape
            src="/decorations/washi-blue.webp"
            width={100}
            rotation={-3}
            opacity={0.85}
            style={{ marginLeft: -40 }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--ink)',
            letterSpacing: 2,
            display: 'inline-block',
            position: 'relative',
            margin: 0,
          }}
        >
          {t('onboarding.currency')}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -4,
              height: 3,
              background: 'var(--accent-soft)',
              borderRadius: 2,
              transform: 'rotate(-0.5deg)',
              opacity: 0.7,
            }}
          />
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginTop: 24,
        }}
      >
        {getAllCurrencies()
          .filter(c => POPULAR_CURRENCIES.includes(c.code))
          .map(c => (
            <button
              key={c.code}
              onClick={() => setCurrencyCode(c.code)}
              aria-pressed={currencyCode === c.code}
              aria-label={c.code}
              style={{
                fontFamily: 'var(--font-body)',
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: currencyCode === c.code ? 'rgba(115, 144, 168, 0.08)' : 'white',
                color: 'var(--ink)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow:
                  currencyCode === c.code
                    ? 'inset 4px 0 0 0 var(--blue), 0 2px 8px rgba(74, 55, 40, 0.06)'
                    : '0 2px 8px rgba(74, 55, 40, 0.06)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: 18, fontWeight: 400 }}>
                  {c.symbol}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--font-en)', letterSpacing: 1 }}>
                  {c.code}
                </div>
              </div>
              {currencyCode === c.code && (
                <span style={{ color: 'var(--blue)', fontWeight: 700 }}>✓</span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}
