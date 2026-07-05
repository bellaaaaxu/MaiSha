// Tier 2/3 长尾兜底：食物小人 + 晕染底（design §8.2）。
// 小人资产缺失/加载失败时回退水彩文字 blob，因此接线先于资产落地也安全。
import { useState } from 'react';
import { assignMascot, mascotUrl } from '@/utils/mascot-registry';
import {
  WatercolorFallback,
  getCategoryColor,
  getBlobShape,
} from '@/components/WatercolorFallback';

interface Props {
  name: string;
  category: string;
  size?: number;
}

export function MascotFallback({ name, category, size = 48 }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <WatercolorFallback name={name} category={category} size={size} />;
  }
  const member = assignMascot(name);
  const colors = getCategoryColor(category);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: getBlobShape(name),
        background: colors.gradient,
        opacity: 0.92,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src={mascotUrl(member)}
        alt=""
        role="presentation"
        width={Math.round(size * 0.82)}
        height={Math.round(size * 0.82)}
        onError={() => setFailed(true)}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}
