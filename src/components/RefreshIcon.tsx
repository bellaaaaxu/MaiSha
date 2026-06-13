interface Props { size?: number; className?: string; }

/** 占位 SVG — 用户后续替换为手绘水彩版本。 */
export function RefreshIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" fill="#fbe6db" opacity="0.4" />
      <path
        d="M 16 5 A 8 8 0 1 1 8 5"
        stroke="#c89377"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 13 4 L 16 5 L 15 8"
        stroke="#c89377"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
