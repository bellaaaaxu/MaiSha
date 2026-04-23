import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const nav = useNavigate();
  return (
    <div className="p-8 flex flex-col items-center min-h-screen justify-center text-center">
      <div className="text-6xl mb-4">🛒</div>
      <div className="text-2xl font-bold mb-2">买啥 MaiSha</div>
      <div className="text-sm text-gray-500 mb-10">和 TA 共享的购物清单</div>
      <div className="space-y-3 w-full max-w-xs mb-10">
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">📝 想到要买的随手加</div>
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">🏪 按超市分组，到店不慌</div>
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">💚 两个人实时同步</div>
      </div>
      <button
        onClick={() => nav('/list')}
        className="w-full max-w-xs h-12 bg-primary text-white rounded-xl font-semibold"
      >
        开始使用
      </button>
    </div>
  );
}
