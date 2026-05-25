import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from './WatercolorFallback';
import type { Item } from '@/types/item';

interface Props {
  items: Item[];
  customIconMap?: Map<string, string>;
  onItemTap?: (item: Item) => void;
}

export function ItemGrid({ items, customIconMap, onItemTap }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px',
      marginBottom: '10px',
    }}>
      {items.map(item => {
        const iconUrl = resolveIconUrl(item.name, customIconMap);
        return (
          <div
            key={item.id}
            onClick={() => onItemTap?.(item)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-icon)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-icon)',
              background: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {iconUrl
                ? <img src={iconUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <WatercolorFallback name={item.name} size={52} category="其他" />
              }
            </div>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink)',
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: 64,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.name}
            </span>
            {(item.note || item.quantity) && (
              <span style={{
                fontSize: 10,
                color: 'var(--ink-faint)',
                textAlign: 'center',
              }}>
                {item.quantity ? `x${item.quantity}` : item.note}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
