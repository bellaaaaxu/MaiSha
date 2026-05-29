import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinByCode } from '@/lib/db';
import { claimAccount } from '@/lib/account';
import { cacheAccount, clearStoredList } from '@/lib/active-list';

const STORAGE_KEY = 'maisha:list-id';

export default function JoinByCode() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const recover = params.get('mode') === 'recover';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const maxLen = recover ? 8 : 6;

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError(recover ? '请输入完整的找回码' : '请输入完整的邀请码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (recover) {
        const account = await claimAccount(trimmed);
        if (!account) {
          setError('找不到这个找回码，请检查后重试');
          setLoading(false);
          return;
        }
        cacheAccount(account);
        clearStoredList(); // 让 /list 的 bootstrap 落到账号首清单
        nav('/list', { replace: true });
      } else {
        const list = await joinByCode(trimmed);
        if (!list) {
          setError('找不到这个清单，请检查邀请码');
          setLoading(false);
          return;
        }
        localStorage.setItem(STORAGE_KEY, list.id);
        nav('/list', { replace: true });
      }
    } catch {
      setError(recover ? '找回失败，请稍后重试' : '加入失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      <div className="text-5xl mb-4">{recover ? '🌿' : '🔑'}</div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: '#5a4e3c' }}>
        {recover ? '找回清单' : '加入清单'}
      </h1>
      <p className="text-sm mb-8" style={{ color: '#a0937e' }}>
        {recover ? '输入你的找回码' : '输入家人分享的邀请码'}
      </p>

      <div className="w-full max-w-xs space-y-4">
        <input
          type="text"
          value={code}
          onChange={e => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLen));
            setError('');
          }}
          placeholder={recover ? '例如 A3F7K2M9' : '例如 A3F7K2'}
          maxLength={maxLen}
          className="w-full text-center text-2xl font-mono tracking-[0.3em] py-4 rounded-xl outline-none"
          style={{
            background: 'rgba(255,252,247,0.7)',
            border: '1px solid rgba(215,205,188,0.5)',
            color: '#5a4e3c',
            letterSpacing: '0.3em',
          }}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        />

        {error && (
          <p className="text-xs text-center" style={{ color: '#c97b63' }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || code.length < 4}
          className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90 disabled:opacity-40"
          style={{ background: '#7ca982' }}
        >
          {loading ? (recover ? '找回中…' : '加入中…') : (recover ? '找回' : '加入')}
        </button>

        <button
          onClick={() => nav(-1)}
          className="w-full text-sm py-2 active:opacity-60"
          style={{ color: '#a0937e' }}
        >
          返回
        </button>
      </div>
    </div>
  );
}
