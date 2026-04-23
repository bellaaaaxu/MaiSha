import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { generateShareText } from '@/utils/share-text';

export default function Settings() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);

  const copyInviteLink = async () => {
    if (!list) return;
    const url = `${location.origin}/list?list=${list.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(`邀请链接已复制：\n${url}\n\n发给老公，他点链接即加入。`);
    } catch {
      prompt('复制链接：', url);
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

      <button
        onClick={copyInviteLink}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>🔗 邀请老公（复制链接）</span>
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
        onClick={() => nav('/manage-markets')}
        className="w-full flex justify-between items-center px-4 py-4 bg-white rounded-xl mb-2 text-sm active:bg-gray-50"
      >
        <span>🏪 管理超市</span>
        <span className="text-gray-300">›</span>
      </button>

      <div className="text-center text-xs text-gray-400 mt-8 space-y-1">
        <div>买啥 MaiSha v1.0.0</div>
        <div>成员 {list?.member_uids.length ?? 0} 人</div>
      </div>
    </div>
  );
}
