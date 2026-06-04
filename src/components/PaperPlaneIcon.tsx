interface Props { size?: number; className?: string; }

/** 占位 SVG — 用户后续替换为手绘水彩版本。 */
export function PaperPlaneIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12 L21 4 L17 21 L11 14 L3 12 Z"
        fill="#fbe6db" stroke="#c89377" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11 14 L21 4" stroke="#c89377" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
