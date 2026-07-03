interface Props { size?: number; className?: string; }

/** 手绘水彩版（mascot-staging 原图经 scripts/compress-ui-icons.mjs 压制）。 */
export function RefreshIcon({ size = 24, className }: Props) {
  return (
    <img
      src="/ui/refresh.webp"
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  );
}
