import { useTranslation } from 'react-i18next';

// 语言名用母语原文，不走 i18n——用户切错语言时也要能认出自己的语言
const LANGS = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LanguageSheet({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-colors ${
        open ? 'bg-black/30 pointer-events-auto' : 'bg-black/0 pointer-events-none'
      }`}
      style={{ zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        className={`mx-6 w-full max-w-xs rounded-3xl p-6 transition-all ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          border: '1px solid rgba(215,205,188,0.5)',
          boxShadow: '0 8px 32px rgba(100,80,50,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold mb-4 text-center" style={{ color: '#5a4e3c' }}>
          {t('settings.language')}
        </div>
        <div className="flex flex-col gap-2">
          {LANGS.map(lang => {
            const active = current === lang.code;
            return (
              <button
                key={lang.code}
                aria-pressed={active}
                onClick={() => { i18n.changeLanguage(lang.code); onClose(); }}
                className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-between px-4 active:opacity-80"
                style={active
                  ? { background: 'rgba(232,174,151,.18)', border: '1px solid rgba(232,174,151,.5)', color: '#5a4e3c' }
                  : { background: 'rgba(255,252,247,0.6)', border: '1px solid rgba(215,205,188,0.4)', color: '#8a7e6b' }}
              >
                <span>{lang.label}</span>
                {active && <span style={{ color: '#7ca982' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
