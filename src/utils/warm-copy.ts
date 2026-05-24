export function getProgressText(remaining: number, _total: number): string {
  if (remaining === 0) return '全部买完啦！';
  if (remaining <= 2) return `快买完啦，还差 ${remaining} 样~`;
  return `快买完啦，还差 ${remaining} 样~`;
}

export function getEmptyListText(): string {
  return '还没想好买什么，慢慢来~';
}

export function getEmptyListSubtext(): string {
  return '点底部 + 开始添加';
}

export function getAddSheetTitle(): string {
  return '今天想吃什么？';
}

export function getFinishShoppingText(checkedCount: number): string {
  return `🛍️ 买完了，清掉 ${checkedCount} 样`;
}

export function getHeaderSubtext(uncheckedCount: number): string {
  if (uncheckedCount === 0) return '清单空空的~';
  return `共享 · ${uncheckedCount}样待买`;
}

export function getBatchAddEncouragement(): string {
  const messages = ['哇，今天大采购！', '准备大显身手！', '好丰盛的清单~'];
  return messages[Math.floor(Math.random() * messages.length)];
}
