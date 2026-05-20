import { useEffect, useState } from 'react';

interface Props {
  /** When non-null, overlay is visible showing this icon */
  iconUrl: string | null;
  /** Item name shown below the icon */
  itemName: string;
  /** Subtitle (e.g. "蔬菜 · 预设图标") */
  subtitle?: string;
}

export function IconPreviewOverlay({ iconUrl, itemName, subtitle }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (iconUrl) {
      setMounted(true);
    } else {
      // Delay unmount slightly for fade-out (not critical, but smoother)
      const t = window.setTimeout(() => setMounted(false), 150);
      return () => window.clearTimeout(t);
    }
  }, [iconUrl]);

  if (!mounted && !iconUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        background: iconUrl ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: 'background 150ms ease',
      }}
    >
      <div
        className="rounded-2xl p-5 text-center"
        style={{
          background: 'white',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          opacity: iconUrl ? 1 : 0,
          transform: `scale(${iconUrl ? 1 : 0.9})`,
          transition: 'opacity 150ms ease, transform 150ms ease',
          minWidth: 200,
        }}
      >
        <div
          className="mx-auto mb-3 rounded-2xl flex items-center justify-center"
          style={{
            width: 160,
            height: 160,
            background: 'rgba(255,252,247,0.8)',
            border: '1px solid rgba(215,205,188,0.3)',
          }}
        >
          {iconUrl && (
            <img
              src={iconUrl}
              alt={itemName}
              className="w-full h-full object-contain p-3"
              style={{ mixBlendMode: 'multiply' }}
            />
          )}
        </div>
        <div className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
          {itemName}
        </div>
        {subtitle && (
          <div className="text-[10px] mt-1" style={{ color: '#a0937e' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
