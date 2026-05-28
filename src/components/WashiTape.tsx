import type { CSSProperties } from 'react';

interface WashiTapeProps {
  src: string;
  rotation?: number;       // degrees, default -3
  width?: number;          // px, default 100
  offsetX?: number;        // px, default 0
  offsetY?: number;        // px, default 0
  opacity?: number;        // default 0.85
  blendMultiply?: boolean; // default false; set true to blend into paper
  style?: CSSProperties;
}

export default function WashiTape({
  src,
  rotation = -3,
  width = 100,
  offsetX = 0,
  offsetY = 0,
  opacity = 0.85,
  blendMultiply = false,
  style,
}: WashiTapeProps) {
  return (
    <img
      role="presentation"
      alt=""
      src={src}
      style={{
        width,
        height: 'auto',
        transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
        opacity,
        mixBlendMode: blendMultiply ? 'multiply' : 'normal',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style,
      }}
      draggable={false}
    />
  );
}
