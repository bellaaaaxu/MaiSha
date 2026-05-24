// src/components/IconPickerPanel.tsx
import { WatercolorFallback } from '@/components/WatercolorFallback';
import type { CategoryKey } from '@/types/item';

interface Props {
  itemName: string;
  category: CategoryKey;
  remainingCredits: number;
  onUpload: () => void;
  onAiGenerate: () => void;
  onSkip: () => void;
}

export function IconPickerPanel({
  itemName,
  category,
  remainingCredits,
  onUpload,
  onAiGenerate,
  onSkip,
}: Props) {
  return (
    <div
      className="rounded-2xl p-3.5 mb-3"
      style={{
        background: 'rgba(255,248,240,0.8)',
        border: '1px solid rgba(240,220,200,0.5)',
      }}
    >
      <div className="text-xs mb-2.5" style={{ color: '#8a6d50' }}>
        没有找到「{itemName}」的图标，请选择：
      </div>

      <div className="flex gap-2.5">
        {/* 1. 使用默认文字 (free, fastest) */}
        <button
          onClick={onSkip}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform"
          style={{
            background: 'white',
            border: '1.5px solid #d5cbbe',
          }}
        >
          <div className="mb-1">
            <WatercolorFallback name={itemName} category={category} size={28} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: '#5a4e3c' }}>使用文字</span>
          <span className="text-[9px] mt-0.5" style={{ color: '#a0937e' }}>免费</span>
        </button>

        {/* 2. 实物拍摄 (free, takes user effort) */}
        <button
          onClick={onUpload}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform"
          style={{
            background: 'white',
            border: '1.5px dashed #c9a882',
          }}
        >
          <span className="text-xl mb-1">📷</span>
          <span className="text-[11px] font-medium" style={{ color: '#8a6d50' }}>实物拍摄</span>
          <span className="text-[9px] mt-0.5" style={{ color: '#a0937e' }}>免费</span>
        </button>

        {/* 3. AI 生成 (advanced, future paid) */}
        <button
          onClick={onAiGenerate}
          disabled={remainingCredits <= 0}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,169,130,0.08), rgba(201,168,130,0.12))',
            border: '1.5px solid #7ca982',
          }}
        >
          {/* "进阶" badge in top-right */}
          <span
            className="absolute top-0 right-0 text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg"
            style={{
              background: 'linear-gradient(135deg, #c97b63, #a85d45)',
              color: 'white',
            }}
          >
            ✨ 进阶
          </span>
          <span className="text-xl mb-1">🎨</span>
          <span className="text-[11px] font-medium" style={{ color: '#5e8a65' }}>AI 生成</span>
          <span className="text-[9px] mt-0.5" style={{ color: '#a0937e' }}>
            {remainingCredits > 0 ? `限免 ${remainingCredits}/5` : '今日已用完'}
          </span>
        </button>
      </div>
    </div>
  );
}
