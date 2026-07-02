type Translator = (key: string) => string;

// 邀请文本发给家人（接收方视角），确认提示给发送者看——后者末行固定接叙事 L2 文案
// （share.description，见 specs/2026-07-02-unified-narrative-design.md §4.5）
export function buildInviteText(
  t: Translator,
  listId: string,
  shortCode: string | null | undefined,
  origin: string
): string {
  const link = `${origin}/list?list=${listId}`;
  if (!shortCode) return link;
  return `${t('listActions.inviteCode')}：${shortCode}\n${t('share.orOpenLink')}${link}`;
}

export function buildCopiedNotice(t: Translator, shortCode: string | null | undefined): string {
  const head = shortCode ? `${t('share.copied')}\n\n${shortCode}` : t('share.copied');
  return `${head}\n\n${t('share.description')}`;
}
