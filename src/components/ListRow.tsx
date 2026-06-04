import { useLongPress } from '@/hooks/useLongPress';
import { useSwipeable } from '@/hooks/useSwipeable';
import { useTranslation } from 'react-i18next';
import type { List } from '@/types/list';

interface Props {
  list: List;
  isCurrent: boolean;
  summary?: string;           // e.g. "8 件待买 · 山姆"
  canArchive: boolean;
  canDelete: boolean;
  isPendingDelete?: boolean;        // NEW
  onTap: () => void;
  onLongPress: () => void;
  onSwipeAction: (action: 'togglePin' | 'archive' | 'delete') => void;
}

const ACTION_W = 126; // 3 × 42

export function ListRow({ list, isCurrent, summary, canArchive, canDelete, isPendingDelete, onTap, onLongPress, onSwipeAction }: Props) {
  const { t } = useTranslation();
  const { handlers, offset, isOpen, close } = useSwipeable({ actionWidth: ACTION_W });
  const lp = useLongPress(() => { if (!isOpen) onLongPress(); });

  // Compose both hooks' pointer handlers so neither overwrites the other.
  // Spread order collision (`{...handlers} {...lp.handlers}`) would make lp win
  // and silently drop the swipeable handlers — manual composition avoids that.
  const composed = {
    onPointerDown: (e: React.PointerEvent) => { handlers.onPointerDown(e); lp.handlers.onPointerDown(e); },
    onPointerMove: (e: React.PointerEvent) => { handlers.onPointerMove(e); lp.handlers.onPointerMove(e); },
    onPointerUp: (e: React.PointerEvent) => { handlers.onPointerUp(e); lp.handlers.onPointerUp(e); },
    onPointerCancel: (e: React.PointerEvent) => { handlers.onPointerCancel(e); lp.handlers.onPointerCancel(e); },
    onPointerLeave: (e: React.PointerEvent) => { lp.handlers.onPointerLeave(e); }, // useSwipeable has no leave handler
  };

  const handleTap = (_e: React.MouseEvent) => {
    // The `return` does the actual suppression — divs have no default click action,
    // and we don't need stopPropagation because no parent currently listens for clicks.
    if (isOpen) { close(); return; }       // swipe panel is open — tap closes it
    if (lp.isLongPressed) return;          // long-press already fired — suppress tap
    onTap();
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, margin: '0 12px 6px' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => onSwipeAction('togglePin')} style={swipeBtnStyle('#d6a06f')}>
          {list.state === 'pinned' ? t('listActions.unpin') : t('listActions.pin')}
        </button>
        <button onClick={() => canArchive && onSwipeAction('archive')} disabled={!canArchive} style={swipeBtnStyle('#b1a18a', !canArchive)}>
          {t('listActions.archive')}
        </button>
        <button onClick={() => canDelete && onSwipeAction('delete')} disabled={!canDelete} style={swipeBtnStyle(isPendingDelete ? '#8a3825' : '#b06a5a', !canDelete)}>
          {isPendingDelete ? t('listActions.confirmDelete', { defaultValue: '确认' }) : t('listActions.delete')}
        </button>
      </div>
      <div
        {...composed}
        onClick={handleTap}
        style={{
          position: 'relative',
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || offset === -ACTION_W ? 'transform .22s ease' : 'none',
          padding: '11px 14px',
          background: isCurrent ? 'rgba(232,174,151,.10)' : '#fffdf9',
          border: `1px solid ${isCurrent ? 'rgba(232,174,151,.55)' : 'rgba(215,205,188,.5)'}`,
          borderRadius: 12,
          cursor: 'pointer',
          touchAction: 'pan-y',
        }}
      >
        {isCurrent && (
          <div style={{ position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, borderRadius: '0 3px 3px 0', background: '#e8ae97' }} />
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#5a4e3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{list.name}</span>
          {isCurrent && (
            <span style={{ fontSize: 10, color: '#c0805f', background: 'rgba(232,174,151,.22)', padding: '1px 7px', borderRadius: 8, fontWeight: 600 }}>
              {t('myLists.currentTag')}
            </span>
          )}
        </div>
        {summary && <div style={{ fontSize: 11, color: '#a0937e', marginTop: 3 }}>{summary}</div>}
      </div>
    </div>
  );
}

function swipeBtnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    width: 42,
    background: disabled ? '#d0c4b1' : bg,
    color: '#fffdf9',
    border: 'none',
    fontSize: 10,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .55 : 1,
  };
}
