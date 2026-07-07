import { useTranslation } from 'react-i18next';

type Variant = 'hero' | 'mini';

interface WordmarkProps {
  variant: Variant;
}

export default function Wordmark({ variant }: WordmarkProps) {
  const { t } = useTranslation();
  const isHero = variant === 'hero';

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div
        style={{
          fontFamily: 'var(--font-wordmark)',
          fontWeight: 700,
          fontSize: isHero ? 56 : 28,
          color: 'var(--ink)',
          letterSpacing: isHero ? 8 : 4,
          lineHeight: 1.1,
          position: 'relative',
          display: 'inline-block',
        }}
      >
        {t('onboarding.wordmark')}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: isHero ? -6 : -3,
            height: isHero ? 3 : 2,
            background: 'var(--accent-soft)',
            borderRadius: 2,
            transform: isHero ? 'rotate(-0.5deg)' : 'rotate(-0.3deg)',
            opacity: 0.7,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-en)',
          fontSize: isHero ? 14 : 10,
          color: isHero ? 'var(--ink-light)' : 'var(--ink-faint)',
          letterSpacing: isHero ? 3 : 2,
          marginTop: isHero ? 10 : 6,
          fontWeight: 600,
        }}
      >
        {t('onboarding.wordmarkLatin')}
      </div>
      {isHero && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            color: 'var(--ink-light)',
            marginTop: 24,
          }}
        >
          {t('onboarding.slogan')}
        </div>
      )}
    </div>
  );
}
