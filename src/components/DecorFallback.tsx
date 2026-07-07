// Tier 2/3 长尾兜底：梅兰竹菊装饰 + 首字角标（design §8.2，2026-07-05 换装）。
// 装饰不声称品类；识别靠角标首字。花图缺失/加载失败回退水彩文字 blob，
// 因此接线先于资产落地也安全。不加 loading="lazy"（与预设图标行为一致）。
import { useState } from 'react';
import { assignDecor, decorUrl } from '@/utils/decor-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { getMonogram } from '@/utils/image-utils';

interface Props {
  name: string;
  category: string;
  size?: number;
}

export function DecorFallback({ name, category, size = 48 }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <WatercolorFallback name={name} category={category} size={size} />;
  }
  const member = assignDecor(name);
  const badge = Math.round(size * 0.42);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img
        src={decorUrl(member)}
        alt=""
        role="presentation"
        width={Math.round(size * 0.94)}
        height={Math.round(size * 0.94)}
        onError={() => setFailed(true)}
        style={{
          objectFit: 'contain',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: badge,
          height: badge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fffdf7',
          border: '1px solid #d5cbbe',
          borderRadius: '30%',
          transform: 'rotate(-6deg)',
          fontFamily: "'ZCOOL KuaiLe', cursive",
          fontSize: badge * 0.62,
          color: '#4a4540',
          lineHeight: 1,
        }}
      >
        {getMonogram(name)}
      </span>
    </div>
  );
}
