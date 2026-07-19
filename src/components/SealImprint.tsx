// 朱红印记：现有 flora webp 经 CSS mask 转剪影 + 圆角方印框 + 斑驳（v1 示意；篆刻风资产 v2 换皮）
import type { CSSProperties } from 'react';

interface Props { sealId: string; size: number; empty?: boolean; rotate?: number; }

export function SealImprint({ sealId, size, empty = false, rotate = -6 }: Props) {
  const frame: CSSProperties = {
    width: size, height: size, borderRadius: size * 0.18,
    border: empty ? '2px dashed #d8ccb6' : '2.5px solid #B0442C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: `rotate(${rotate}deg)`, background: empty ? 'transparent' : 'rgba(176,68,44,0.06)',
    flexShrink: 0,
  };
  if (empty) return <div style={frame} />;
  const url = `url(/flora/${sealId}.webp)`;
  return (
    <div style={frame}>
      <div
        data-seal-ink
        style={{
          width: size * 0.72, height: size * 0.72,
          background: '#B0442C',
          maskImage: url, WebkitMaskImage: url,
          maskSize: 'contain', WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center', WebkitMaskPosition: 'center',
          opacity: 0.92,   // 印泥微透 = 斑驳示意
        }}
      />
    </div>
  );
}
