import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { saveCurrency, getAllCurrencies, getOrDetectCurrency } from '@/utils/currency';
import type { Store } from '@/types/store';

const POPULAR_CURRENCIES = ['CNY', 'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'HKD', 'TWD', 'SGD'];
const TOTAL_STEPS = 3;

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 24px',
      background: 'var(--paper)',
    }}>
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
            marginBottom: 16,
          }}
        >
          ← {t('shopping.back')}
        </button>
      )}

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? 'var(--green)' : i < step ? 'var(--green-soft)' : 'var(--ink-faint)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>

        {/* Step 0: Language selection */}
        {step === 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌏</div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)' }}>
                {t('settings.language')}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-card)',
                    border: language === lang.code
                      ? '2px solid var(--green)'
                      : '2px solid var(--ink-faint)',
                    background: language === lang.code
                      ? 'rgba(123, 163, 126, 0.1)'
                      : 'white',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{lang.label}</span>
                  {language === lang.code && (
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Add stores (free text) */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)' }}>
                {t('onboarding.addStores')}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 4 }}>
                {t('onboarding.addStoresHint')}
              </p>
            </div>

            {/* Added stores */}
            {addedStores.map((store, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                padding: '10px 16px',
                background: 'white',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--ink-faint)',
              }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink)' }}>
                  {store.name}
                </span>
                <button
                  onClick={() => removeStore(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: 'var(--ink-faint)', padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Input for new store */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newStoreName}
                onChange={e => setNewStoreName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStore(); }}
                placeholder={t('onboarding.storePlaceholder')}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--ink-faint)',
                  background: 'white',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              {newStoreName.trim() && (
                <button
                  onClick={addStore}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'white',
                    background: 'var(--green)',
                    border: 'none',
                    borderRadius: 'var(--radius-card)',
                    padding: '10px 16px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.confirm')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Currency */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)' }}>
                {t('onboarding.currency')}
              </h2>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}>
              {getAllCurrencies()
                .filter(c => POPULAR_CURRENCIES.includes(c.code))
                .map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrencyCode(c.code)}
                    style={{
                      fontFamily: 'var(--font-body)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-card)',
                      border: currencyCode === c.code
                        ? '2px solid var(--green)'
                        : '2px solid var(--ink-faint)',
                      background: currencyCode === c.code
                        ? 'rgba(123, 163, 126, 0.1)'
                        : 'white',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{c.symbol}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{c.code}</div>
                    </div>
                    {currencyCode === c.code && (
                      <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div style={{ maxWidth: 360, margin: '0 auto', width: '100%', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={goNext}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            color: 'white',
            background: 'var(--green)',
            border: 'none',
            cursor: 'pointer',
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
              color: 'var(--ink-faint)',
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
