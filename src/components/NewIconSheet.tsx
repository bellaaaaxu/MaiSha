import { useState, useEffect } from 'react';
import { IconPickerPanel } from '@/components/IconPickerPanel';
import { AiPreviewModal } from '@/components/AiPreviewModal';
import { cropToSquare, processImageForUpload, sanitizeItemName } from '@/utils/image-utils';
import { uploadCustomIcon, generateIcon, getRemainingCredits } from '@/lib/custom-icons';
import { getIconPath } from '@/utils/icon-registry';

interface Props {
  open: boolean;
  uid: string;
  listId: string;
  initialName?: string;
  onClose: () => void;
  onIconCreated: () => void | Promise<void>;
}

type Stage = 'name' | 'preset_warn' | 'picker';

export function NewIconSheet({ open, uid, listId, initialName, onClose, onIconCreated }: Props) {
  const [stage, setStage] = useState<Stage>('name');
  const [name, setName] = useState('');
  const [remainingCredits, setRemainingCredits] = useState(5);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [showStylize, setShowStylize] = useState(false);

  useEffect(() => {
    if (open) {
      const startName = initialName ?? '';
      setName(startName);
      if (startName) {
        const trimmed = sanitizeItemName(startName);
        // If preset exists, go to warn stage; otherwise straight to picker
        if (getIconPath(trimmed)) {
          setStage('preset_warn');
        } else {
          setStage('picker');
        }
      } else {
        setStage('name');
      }
      getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
    } else {
      // Cleanup on close
      setAiModalOpen(false);
      setAiLoading(false);
      setAiError(null);
      setAiImageUrl(null);
      setUploadedPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setShowStylize(false);
    }
  }, [open, uid, initialName]);

  if (!open) return null;

  const handleNext = () => {
    const trimmed = sanitizeItemName(name);
    if (!trimmed) return;

    // Preset check
    if (getIconPath(trimmed)) {
      setStage('preset_warn');
    } else {
      setStage('picker');
    }
  };

  const itemName = sanitizeItemName(name);

  const handleUploadPhoto = () => {
    if (!itemName) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      try {
        const cropped = await cropToSquare(file);
        const compressed = await processImageForUpload(cropped);
        await uploadCustomIcon(listId, itemName, compressed, 'upload', uid);
        await onIconCreated();
        setUploadedPreviewUrl(URL.createObjectURL(compressed));
        setShowStylize(true);
        setAiModalOpen(true);
      } catch (err) {
        console.error('Upload failed:', err);
        alert('上传失败，请重试');
      }
    };
    input.click();
  };

  const handleAiGenerate = async (referenceImageBase64?: string) => {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiError(null);
    setAiImageUrl(null);
    setShowStylize(false);

    try {
      const result = await generateIcon(itemName, listId, referenceImageBase64);
      setAiImageUrl(result.image_url);
      setRemainingCredits(result.remaining_today);
    } catch (err: any) {
      if (err.code === 'RATE_LIMIT') {
        setAiError('今日生成额度已用完');
        setRemainingCredits(0);
      } else {
        setAiError('生成失败，请稍后重试');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAccept = async () => {
    await onIconCreated();
    setAiModalOpen(false);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
    setShowStylize(false);
    onClose();
  };

  const handleStylize = async () => {
    if (!uploadedPreviewUrl) return;
    try {
      const response = await fetch(uploadedPreviewUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        URL.revokeObjectURL(uploadedPreviewUrl);
        setUploadedPreviewUrl(null);
        setShowStylize(false);
        handleAiGenerate(base64);
      };
      reader.readAsDataURL(blob);
    } catch {
      alert('转换失败，请重试');
    }
  };

  const handleAiSkip = () => {
    setAiModalOpen(false);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
    setShowStylize(false);
    onClose();
  };

  return (
    <>
      {!aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
          <div
            className="w-full rounded-t-3xl p-5 pb-8"
            style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3">
              <div className="w-10 h-1 rounded-full" style={{ background: '#d5cbbe' }} />
            </div>

            {stage === 'name' && (
              <>
                <div className="text-center text-base font-semibold mb-4" style={{ color: '#5a4e3c' }}>
                  新增图标
                </div>
                <div className="text-xs mb-2" style={{ color: '#a0937e' }}>
                  物品名称
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                  placeholder="例如：椰浆"
                  maxLength={30}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(255,252,247,0.8)',
                    border: '1px solid rgba(215,205,188,0.4)',
                    color: '#5a4e3c',
                  }}
                />
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl text-sm font-medium active:opacity-80"
                    style={{
                      background: 'rgba(255,252,247,0.8)',
                      border: '1px solid rgba(215,205,188,0.4)',
                      color: '#a0937e',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!sanitizeItemName(name)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
                    style={{ background: '#7ca982' }}
                  >
                    下一步
                  </button>
                </div>
              </>
            )}

            {stage === 'preset_warn' && (
              <>
                <div className="text-center text-base font-semibold mb-3" style={{ color: '#5a4e3c' }}>
                  「{itemName}」已有预设图标
                </div>
                <div
                  className="mx-auto mb-3 rounded-2xl flex items-center justify-center"
                  style={{
                    width: 100, height: 100,
                    background: 'rgba(255,252,247,0.8)',
                    border: '1px solid rgba(215,205,188,0.3)',
                  }}
                >
                  <img
                    src={getIconPath(itemName) ?? undefined}
                    alt={itemName}
                    draggable={false}
                    className="w-full h-full object-contain p-2 pointer-events-none"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
                <div className="text-center text-xs mb-5 px-4 leading-relaxed" style={{ color: '#8a6d50' }}>
                  你可以继续新建一个自定义图标来替换它，<br />
                  也可以保留现有的预设图标
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl text-sm font-medium active:opacity-80"
                    style={{
                      background: 'rgba(255,252,247,0.8)',
                      border: '1px solid rgba(215,205,188,0.4)',
                      color: '#5a4e3c',
                    }}
                  >
                    保留预设
                  </button>
                  <button
                    onClick={() => setStage('picker')}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white active:opacity-80"
                    style={{ background: '#c97b63' }}
                  >
                    新建替换
                  </button>
                </div>
              </>
            )}

            {stage === 'picker' && (
              <>
                <div className="text-center text-sm font-semibold mb-3" style={{ color: '#5a4e3c' }}>
                  为「{itemName}」选择图标
                </div>
                <IconPickerPanel
                  itemName={itemName}
                  category="其他"
                  remainingCredits={remainingCredits}
                  onUpload={handleUploadPhoto}
                  onAiGenerate={() => handleAiGenerate()}
                  onSkip={onClose}
                />
              </>
            )}
          </div>
        </div>
      )}

      <AiPreviewModal
        open={aiModalOpen}
        itemName={itemName}
        imageUrl={uploadedPreviewUrl ?? aiImageUrl}
        loading={aiLoading}
        error={aiError}
        remainingCredits={remainingCredits}
        onAccept={handleAccept}
        onRetry={() => handleAiGenerate()}
        onSkip={handleAiSkip}
        showStylize={showStylize}
        onStylize={handleStylize}
      />
    </>
  );
}
