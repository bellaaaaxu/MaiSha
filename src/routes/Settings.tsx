import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { generateShareText } from '@/utils/share-text';
import { getCachedAccount } from '@/lib/active-list';
import { buildInviteText, buildCopiedNotice } from '@/utils/invite-text';

export default function Settings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);

  const account = getCachedAccount();

  const copyRecoveryCode = async () => {
    if (!account?.recovery_code) return;
    try {
      await navigator.clipboard.writeText(account.recovery_code);
      alert(`找回码已复制！\n\n${account.recovery_code}\n\n换手机或重装时，用它找回清单`);
    } catch {
      prompt('复制：', account.recovery_code);
    }
  };

  const copyInviteLink = async () => {
    if (!list) return;
    const text = buildInviteText(t, list.id, list.short_code, location.origin);
    try {
      await navigator.clipboard.writeText(text);
      alert(buildCopiedNotice(t, list.short_code));
    } catch {
      prompt(t('listActions.shareCopy'), text);
    }
  };

  const copyText = async () => {
    if (!list) return;
    const text = generateShareText(items, list.supermarkets);
    try {
      await navigator.clipboard.writeText(text);
      alert('清单文本已复制');
    } catch {
      prompt('复制：', text);
    }
  };

  return (
    <div className="p-4 min-h-screen">
      <header className="flex items-center mb-4">
        <button onClick={() => nav(-1)} className="text-primary text-sm mr-3">‹ 返回</button>
        <div className="text-base font-semibold">设置</div>
      </header>

      {account?.recovery_code && (
        <div className="mb-3 px-4 py-3 bg-white rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs" style={{ color: '#a0937e' }}>找回码</div>
              <div className="text-xl font-mono font-bold tracking-[0.2em] mt-0.5" style={{ color: '#5a4e3c' }}>
                {account.recovery_code}
              </div>
            </div>
            <button
              onClick={copyRecoveryCode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium active:opacity-80"
              style={{ background: '#7ca982', color: '#fff' }}
            >
              复制
            </button>
          </div>
          <div className="text-xs mt-2" style={{ color: '#a0937e' }}>
            换手机或重装，输入它就能找回你的清单
          </div>
        </div>
      )}

      {list?.short_code && (
        <div className="mb-3 px-4 py-3 bg-white rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: '#a0937e' }}>清单邀请码</div>
            <div className="text-xl font-mono font-bold tracking-[0.2em] mt-0.5" style={{ color: '#5a4e3c' }}>
              {list.short_code}
            </div>
          </div>
          <button
            onClick={copyInviteLink}
            className="px-3 py-1.5 rounded-lg text-xs font-medium active:opacity-80"
            style={{ background: '#7ca982', color: '#fff' }}
          >
            复制
          </button>
        </div>
      )}

      <button
        onClick={() => nav('/join')}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>🔑 输入邀请码加入</span>
        <span className="text-gray-300">›</span>
      </button>

      <button
        onClick={copyText}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>📋 复制清单文本</span>
        <span className="text-gray-300">›</span>
      </button>

      <button
        onClick={() => nav('/manage-stores')}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>🏪 管理超市</span>
        <span className="text-gray-300">›</span>
      </button>

      <button
        onClick={() => nav('/privacy')}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>🔒 隐私政策</span>
        <span className="text-gray-300">›</span>
      </button>

      <div className="text-center text-xs text-gray-400 mt-8 space-y-1">
        <div>买啥 MaiSha v1.0.0</div>
        <div>成员 {list?.member_uids.length ?? 0} 人</div>
      </div>
    </div>
  );
}
