import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { saveCurrency, getOrDetectCurrency } from '@/utils/currency';
import Wordmark from '@/components/Wordmark';
import type { Store } from '@/types/store';

const TOTAL_STEPS = 3;

const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"), linear-gradient(180deg, var(--paper) 0%, #F7F0E6 100%)`;

export default function Onboarding() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language || 'zh-CN');
  const [addedStores, setAddedStores] = useState<Store[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const detectedCurrency = getOrDetectCurrency();
  const [currencyCode, setCurrencyCode] = useState(detectedCurrency.code);

  const goNext = () => {
    if (step >= TOTAL_STEPS - 1) return finish();
    setStep(s => s + 1);
  };

  const goBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  const addStore = () => {
    const name = newStoreName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    setAddedStores(prev => [...prev, { id, name }]);
    setNewStoreName('');
  };

  const removeStore = (index: number) => {
    setAddedStores(prev => prev.filter((_, i) => i !== index));
  };

  const finish = () => {
    saveCurrency(currencyCode);
    const stores: Store[] = [
      ...addedStores,
      { id: 'none', name: t('addSheet.noStore') },
    ];
    localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(stores));
    localStorage.setItem('maisha:language', language);
    localStorage.setItem('maisha:seen', '1');
    nav('/list');
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
            newStoreName={newStoreName}
            setNewStoreName={setNewStoreName}
            addStore={addStore}
            removeStore={removeStore}
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
      </div>
    </div>
  );
}

// Placeholder step components — replaced in Tasks 5/6/7
function Step0Language({ language, setLanguage }: { language: string; setLanguage: (l: string) => void }) {
  const { i18n } = useTranslation();
  return (
    <div>
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
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              padding: '14px 20px',
              marginBottom: 12,
              borderRadius: 14,
              border: 'none',
              background: 'white',
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

function Step1Stores(_props: {
  addedStores: Store[];
  newStoreName: string;
  setNewStoreName: (s: string) => void;
  addStore: () => void;
  removeStore: (i: number) => void;
}) {
  return <div>Step 1 placeholder — replaced in Task 6</div>;
}

function Step2Currency(_props: { currencyCode: string; setCurrencyCode: (c: string) => void }) {
  return <div>Step 2 placeholder — replaced in Task 7</div>;
}
