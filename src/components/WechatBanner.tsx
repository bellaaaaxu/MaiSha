import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uaEnv } from '@/utils/analytics-core';

interface Props {
  // 可注入 UA 便于测试；缺省读真实环境
  ua?: string;
}

// 微信 webview 身份分裂的最小对策：常驻细条（不挡内容，故不可关）+ 点开全屏指引。
// 完整身份迁移（join/recovery code 桥接、Universal Links）留 v1.1。
export function WechatBanner({ ua }: Props) {
  const { t } = useTranslation();
  const [guideOpen, setGuideOpen] = useState(false);
  if (uaEnv(ua ?? navigator.userAgent) !== 'wechat') return null;

  return (
    <>
      <button
        onClick={() => setGuideOpen(true)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: '#fdf3e4',
          border: 'none',
          borderBottom: '1px solid #ecd9b8',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13 }} aria-hidden>🧭</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, color: '#7a5a38' }}>
          {t('wechat.banner')}
        </span>
        <span style={{ fontSize: 13, color: '#b08d5f' }} aria-hidden>›</span>
      </button>

      {guideOpen && (
        <div
          onClick={() => setGuideOpen(false)}
          /* z 1200：指引必须压过一切弹层（NoticeModal/ConfirmModal 是 1100） */
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(40,30,20,0.72)',
            display: 'flex',
            flexDirection: 'column',
            padding: 20,
          }}
        >
          <div style={{ textAlign: 'right', color: '#fff' }}>
            <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>↗</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#f3ede4', marginTop: 4 }}>
              {t('wechat.step1')}
            </div>
          </div>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              marginTop: 24,
              background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
              border: '1px solid rgba(215,205,188,0.5)',
              borderRadius: 18,
              padding: '18px 16px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: '#4a3728', marginBottom: 12 }}>
              {t('wechat.title')}
            </div>
            <StepLine n={1} text={t('wechat.step1')} />
            <StepLine n={2} text={t('wechat.step2')} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#a0937e', margin: '10px 0 14px', lineHeight: 1.6 }}>
              {t('wechat.note')}
            </p>
            <button
              onClick={() => setGuideOpen(false)}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: '#7ca982',
                color: '#fff',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('wechat.ok')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StepLine({ n, text }: { n: number; text: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        color: '#7a6a54',
        margin: '0 0 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#7ca982',
          color: '#fff',
          fontSize: 11,
          textAlign: 'center',
          lineHeight: '18px',
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      {text}
    </p>
  );
}
