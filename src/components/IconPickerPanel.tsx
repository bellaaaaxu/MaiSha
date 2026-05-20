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
        没有找到「{itemName}」的预设图标，选择一种方式：
      </div>

      <div className="flex gap-2.5">
        {/* Upload photo */}
        <button
          onClick={onUpload}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform"
          style={{
            background: 'white',
            border: '1.5px dashed #c9a882',
          }}
        >
          <span className="text-xl mb-1">📷</span>
          <span className="text-[11px] font-medium" style={{ color: '#8a6d50' }}>上传照片</span>
        </button>

        {/* AI generate */}
        <button
          onClick={onAiGenerate}
          disabled={remainingCredits <= 0}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
          style={{
            background: 'white',
            border: '1.5px dashed #7ca982',
          }}
        >
          <span className="text-xl mb-1">🎨</span>
          <span className="text-[11px] font-medium" style={{ color: '#5e8a65' }}>AI 生成</span>
          <span className="text-[9px] mt-0.5" style={{ color: '#aaa' }}>
            {remainingCredits > 0 ? `剩余 ${remainingCredits}/5 次` : '今日已用完'}
          </span>
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          className="flex-1 flex flex-col items-center rounded-xl p-3 active:scale-95 transition-transform"
          style={{
            background: 'white',
            border: '1.5px solid #e0e0e0',
          }}
        >
          <div className="mb-1">
            <WatercolorFallback name={itemName} category={category} size={24} />
          </div>
          <span className="text-[11px] font-medium" style={{ color: '#999' }}>先跳过</span>
        </button>
      </div>
    </div>
  );
}
