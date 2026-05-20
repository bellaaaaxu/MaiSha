import { useState, useEffect } from 'react';
import { IconPickerPanel } from '@/components/IconPickerPanel';
import { AiPreviewModal } from '@/components/AiPreviewModal';
import { cropToSquare, processImageForUpload, sanitizeItemName } from '@/utils/image-utils';
import { uploadCustomIcon, generateIcon, getRemainingCredits } from '@/lib/custom-icons';
import type { Item } from '@/types/item';

interface Props {
  /** Item to set the icon for, or null to close */
  item: Item | null;
  uid: string;
  listId: string;
  onClose: () => void;
  onIconsChanged: () => void | Promise<void>;
}

export function SetIconSheet({ item, uid, listId, onClose, onIconsChanged }: Props) {
  const [remainingCredits, setRemainingCredits] = useState(5);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [showStylize, setShowStylize] = useState(false);

  useEffect(() => {
    if (item) {
      getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
    } else {
      // Cleanup when closing
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
  }, [item, uid]);

  if (!item) return null;

  const itemName = sanitizeItemName(item.name);

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

        // No conflict prompt — user explicitly chose to set/replace icon
        await uploadCustomIcon(listId, itemName, compressed, 'upload', uid);
        await onIconsChanged();

        // Show preview with stylize option
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
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'RATE_LIMIT') {
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
    // Icon saved already (by Edge Function or by upload), just refresh and close
    await onIconsChanged();
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
    // User declined the AI result; close without changing anything
    setAiModalOpen(false);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
    setShowStylize(false);
    onClose();
  };

  return (
    <>
      {/* Picker panel as a bottom sheet */}
      {!aiModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={onClose}
        >
          <div
            className="w-full rounded-t-3xl p-5 pb-8"
            style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3">
              <div className="w-10 h-1 rounded-full" style={{ background: '#d5cbbe' }} />
            </div>
            <div className="text-center text-sm font-semibold mb-3" style={{ color: '#5a4e3c' }}>
              为「{item.name}」设置图标
            </div>
            <IconPickerPanel
              itemName={item.name}
              category={item.category}
              remainingCredits={remainingCredits}
              onUpload={handleUploadPhoto}
              onAiGenerate={() => handleAiGenerate()}
              onSkip={onClose}
            />
          </div>
        </div>
      )}

      {/* AI preview modal */}
      <AiPreviewModal
        open={aiModalOpen}
        itemName={item.name}
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
