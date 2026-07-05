// src/components/WatercolorFallback.tsx
import { getAdaptiveLabel } from '@/utils/image-utils';

interface WatercolorColors {
  gradient: string;
  textColor: string;
}

export const CATEGORY_WATERCOLORS: Record<string, WatercolorColors> = {
  '蔬菜':   { gradient: 'radial-gradient(ellipse at 40% 40%, #a8d5a2 0%, #7ca982 60%, #5e9065 100%)', textColor: '#2d4a2d' },
  '水果':   { gradient: 'radial-gradient(ellipse at 42% 38%, #f5d4a0 0%, #e8b866 60%, #d4a040 100%)', textColor: '#5a4520' },
  '肉蛋':   { gradient: 'radial-gradient(ellipse at 45% 35%, #f0c9a0 0%, #c97b63 60%, #a85d45 100%)', textColor: '#4a2a1a' },
  '乳制品': { gradient: 'radial-gradient(ellipse at 40% 42%, #f5eed8 0%, #d4c9a8 60%, #c4b890 100%)', textColor: '#5a5030' },
  '主食':   { gradient: 'radial-gradient(ellipse at 38% 40%, #c8d5e8 0%, #8b9dc3 60%, #6a80a8 100%)', textColor: '#2a3550' },
  '烘焙':   { gradient: 'radial-gradient(ellipse at 44% 38%, #f0d4c0 0%, #c9886d 60%, #a86d52 100%)', textColor: '#4a2e20' },
  '调料':   { gradient: 'radial-gradient(ellipse at 40% 40%, #dcc8a0 0%, #b08d57 60%, #957540 100%)', textColor: '#3a2e15' },
  '零食':   { gradient: 'radial-gradient(ellipse at 42% 40%, #f0d8e0 0%, #d4a0b0 60%, #c08090 100%)', textColor: '#4a2030' },
  '饮料':   { gradient: 'radial-gradient(ellipse at 38% 42%, #a8c8e8 0%, #6a9ec4 60%, #4a7ea0 100%)', textColor: '#1e3a52' },
  '日用':   { gradient: 'radial-gradient(ellipse at 42% 38%, #d4b8d4 0%, #9b8ec0 60%, #7a70a0 100%)', textColor: '#3a2e52' },
  '海鲜':   { gradient: 'radial-gradient(ellipse at 40% 40%, #a8d8d0 0%, #5fa098 60%, #45827a 100%)', textColor: '#16352f' },
  '豆制品': { gradient: 'radial-gradient(ellipse at 42% 38%, #e6eccc 0%, #c2cc92 60%, #a6b270 100%)', textColor: '#3c4420' },
  '干货':   { gradient: 'radial-gradient(ellipse at 44% 38%, #e8cba8 0%, #c19a6b 60%, #a07d4e 100%)', textColor: '#422e18' },
  '速冻':   { gradient: 'radial-gradient(ellipse at 38% 42%, #d4e4f0 0%, #a8c4dc 60%, #88a8c8 100%)', textColor: '#2a4258' },
  '方便食品': { gradient: 'radial-gradient(ellipse at 45% 35%, #f0c8a8 0%, #d49a6e 60%, #b87c50 100%)', textColor: '#4a2e1a' },
  '酒水':   { gradient: 'radial-gradient(ellipse at 40% 40%, #e0b8b0 0%, #b07068 60%, #8e5048 100%)', textColor: '#3e1e1a' },
  '个护':   { gradient: 'radial-gradient(ellipse at 42% 40%, #f2dce8 0%, #d4aec6 60%, #b888a4 100%)', textColor: '#4a2840' },
  '其他':   { gradient: 'radial-gradient(ellipse at 40% 40%, #e8e2d8 0%, #d5d0c8 60%, #b8b0a5 100%)', textColor: '#4a4540' },
};

const BLOB_SHAPES = [
  '48% 52% 43% 57% / 52% 45% 55% 48%',
  '52% 48% 55% 45% / 45% 52% 48% 55%',
  '45% 55% 50% 50% / 55% 48% 52% 45%',
  '50% 50% 45% 55% / 48% 55% 45% 52%',
  '47% 53% 52% 48% / 53% 47% 50% 50%',
];

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(category: string): WatercolorColors {
  return CATEGORY_WATERCOLORS[category] ?? CATEGORY_WATERCOLORS['其他'];
}

export function getBlobShape(name: string): string {
  return BLOB_SHAPES[hashCode(name) % BLOB_SHAPES.length];
}

interface Props {
  name: string;
  category: string;
  size?: number;
}

export function WatercolorFallback({ name, category, size = 48 }: Props) {
  const label = getAdaptiveLabel(name);
  const colors = getCategoryColor(category);
  const shape = getBlobShape(name);
  const fontSize = label.length <= 1 ? size * 0.45 : label.length <= 2 ? size * 0.36 : size * 0.28;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: shape,
        background: colors.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.85,
        boxShadow: 'inset 0 -2px 6px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: colors.textColor,
          fontSize,
          fontFamily: "'Segoe Script', 'Comic Sans MS', cursive",
          fontWeight: 400,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
}
