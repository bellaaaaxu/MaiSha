interface Props { size?: number; className?: string; }

/** 占位 SVG — 用户后续替换为手绘水彩版本。 */
export function ListSwitcherIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="6" width="14" height="11" rx="2"
        stroke="#c89377" strokeWidth="1.8" fill="#fbe6db" strokeLinejoin="round" />
      <rect x="6" y="3" width="14" height="11" rx="2"
        stroke="#c89377" strokeWidth="1.8" fill="#faf6f0" strokeLinejoin="round" />
      <line x1="9" y1="7" x2="16" y2="7" stroke="#c89377" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="10" x2="14" y2="10" stroke="#c89377" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
