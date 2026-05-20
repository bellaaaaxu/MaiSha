// src/utils/image-utils.ts
import imageCompression from 'browser-image-compression';

export function detectLanguage(text: string): 'zh' | 'en' {
  if (!text) return 'en';
  const code = text.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) ? 'zh' : 'en';
}

export function getAdaptiveLabel(name: string): string {
  if (!name) return '';
  const lang = detectLanguage(name);
  if (lang === 'zh') {
    return name.length <= 3 ? name : name.slice(0, 2);
  }
  return name.length <= 4 ? name : name.slice(0, 3);
}

export async function processImageForUpload(file: File): Promise<Blob> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 256,
    useWebWorker: true,
    fileType: 'image/webp',
  });
  return compressed;
}

export async function cropToSquare(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, x, y, size, size, 0, 0, 256, 256);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        resolve(new File([blob], 'cropped.webp', { type: 'image/webp' }));
      }, 'image/webp', 0.85);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function sanitizeItemName(name: string): string {
  return name
    .trim()
    .slice(0, 30)
    .replace(/[<>{}[\]\\`$]/g, '');
}
