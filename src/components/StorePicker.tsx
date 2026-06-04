import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Store } from '@/types/store';

interface Props {
  stores: Store[];
  onChange: (next: Store[]) => void;
  placeholder?: string;
}

// Rotation and border color cycle per row index — matches Onboarding step 1 visuals exactly.
const CHIP_ROTATIONS = [-0.3, 0.2, -0.15, 0.25, -0.2];
const CHIP_BORDER_COLORS = ['var(--accent-soft)', 'var(--green-soft)', 'var(--blue)'];

/** 店铺名列表：输入名称→加行，点行上的 × 移除。沿用 Onboarding step 1 视觉。 */
export function StorePicker({ stores, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const hasInput = input.trim().length > 0;

  const add = () => {
    const name = input.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (stores.some(s => s.id === id)) { setInput(''); return; }
    onChange([...stores, { id, name }]);
    setInput('');
  };

  const remove = (i: number) => onChange(stores.filter((_, idx) => idx !== i));

  return (
    <div>
      {/* Store rows */}
      {stores.map((store, i) => (
        <div
          key={`${store.id}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            padding: '14px 16px',
            background: 'white',
            borderRadius: 14,
            boxShadow: 'var(--shadow-card)',
            borderLeft: `4px solid ${CHIP_BORDER_COLORS[i % CHIP_BORDER_COLORS.length]}`,
            transform: `rotate(${CHIP_ROTATIONS[i % CHIP_ROTATIONS.length]}deg)`,
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--font-title)',
              fontSize: 18,
              letterSpacing: 1,
              color: 'var(--ink)',
            }}
          >
            {store.name}
          </span>
          <button
            onClick={() => remove(i)}
            aria-label={t('storePicker.remove') ?? 'Remove store'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--ink-faint)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Input area */}
      <div style={{ display: 'flex', gap: 8, marginTop: stores.length > 0 ? 16 : 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder ?? t('storePicker.placeholder') ?? '店铺名'}
          style={{
            flex: 1,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            padding: '12px 16px',
            borderRadius: 14,
            border: '1px dashed var(--ink-faint)',
            background: 'white',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button
          onClick={add}
          disabled={!hasInput}
          aria-label={t('storePicker.add') ?? 'Add store'}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: hasInput ? 'var(--accent)' : 'white',
            color: hasInput ? 'white' : 'var(--ink-faint)',
            fontSize: 24,
            fontWeight: 300,
            cursor: hasInput ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, color 0.2s',
            flexShrink: 0,
            boxShadow: hasInput ? 'none' : '0 2px 8px rgba(74, 55, 40, 0.06)',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
