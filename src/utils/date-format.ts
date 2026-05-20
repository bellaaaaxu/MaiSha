/**
 * Format a date as relative time in Chinese.
 * Examples: "刚刚", "5分钟前", "3小时前", "昨天", "3天前", "2周前", "1个月前"
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 7) return `${diffDay}天前`;
  if (diffWeek < 4) return `${diffWeek}周前`;
  if (diffMonth < 12) return `${diffMonth}个月前`;
  return `${Math.floor(diffMonth / 12)}年前`;
}

/**
 * Format the source label of a custom icon.
 */
export function formatSourceLabel(source: 'upload' | 'ai_generated' | 'ai_stylized'): string {
  switch (source) {
    case 'upload': return '📷 上传';
    case 'ai_generated': return 'AI 生成';
    case 'ai_stylized': return '🎨 AI 水彩化';
  }
}
