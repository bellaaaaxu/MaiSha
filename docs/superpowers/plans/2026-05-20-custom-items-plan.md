# Custom Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add custom items with uploaded photos or AI-generated watercolor icons, shared across family lists, with watercolor text fallback replacing emoji.

**Architecture:** Supabase Edge Function proxies Gemini Imagen API for AI generation. Uploaded and generated images stored in Supabase Storage. New `custom_icons` and `ai_generation_log` tables. Frontend changes in AddSheet, ItemRow, and icon-registry. PWA caching for offline custom icons.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL, Storage, Edge Functions/Deno), Gemini Imagen API, Vite + vite-plugin-pwa (Workbox), Vitest

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/003_custom_icons.sql` | DB migration: `custom_icons` table, `ai_generation_log` table, RLS policies, indexes |
| `supabase/functions/generate-icon/index.ts` | Edge Function: validate auth, check rate limits, call Gemini Imagen, store result |
| `src/lib/custom-icons.ts` | Client-side API for custom icons: fetch, upload, generate, delete, check conflicts |
| `src/utils/image-utils.ts` | Client-side image processing: crop, resize, compress to webp |
| `src/components/WatercolorFallback.tsx` | Adaptive watercolor text fallback component (replaces emoji fallback) |
| `src/components/IconPickerPanel.tsx` | The "no preset match" UI panel with upload/AI/skip options |
| `src/components/AiPreviewModal.tsx` | AI generation preview with accept/retry/skip actions |
| `src/hooks/useCustomIcons.ts` | Hook to fetch and cache custom icons for a list |
| `tests/watercolor-fallback.test.ts` | Tests for adaptive text truncation logic |
| `tests/image-utils.test.ts` | Tests for image processing utilities |
| `tests/custom-icons.test.ts` | Tests for custom icon client API |

### Modified files

| File | Changes |
|------|---------|
| `src/utils/icon-registry.ts` | Add `resolveIconUrl` function that checks preset → custom → null |
| `src/components/ItemRow.tsx` | Use custom icons + watercolor fallback instead of emoji |
| `src/components/AddSheet.tsx` | Integrate IconPickerPanel when no preset match found |
| `src/hooks/useItems.ts` | (No change needed — items table unchanged) |
| `vite.config.ts` | Add Workbox runtime caching rule for custom-icons Storage URLs |
| `package.json` | Add `browser-image-compression` dependency |
| `.env` | Document `GEMINI_API_KEY` (Edge Function env var, not committed) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_custom_icons.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/003_custom_icons.sql
-- Custom icons and AI generation tracking

CREATE TABLE custom_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'ai_generated', 'ai_stylized')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One icon per item name per list
CREATE UNIQUE INDEX idx_custom_icons_list_name ON custom_icons(list_id, name);
CREATE INDEX idx_custom_icons_list_id ON custom_icons(list_id);

-- Auto-update updated_at
CREATE TRIGGER custom_icons_touch_updated_at
  BEFORE UPDATE ON custom_icons
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE custom_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read custom_icons"
  ON custom_icons FOR SELECT
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members insert custom_icons"
  ON custom_icons FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids))
    AND created_by = auth.uid()::text
  );

CREATE POLICY "members update custom_icons"
  ON custom_icons FOR UPDATE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

CREATE POLICY "members delete custom_icons"
  ON custom_icons FOR DELETE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

-- AI generation log for rate limiting
CREATE TABLE ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL,
  item_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_gen_log_user_date ON ai_generation_log(user_uid, created_at);
CREATE INDEX idx_ai_gen_log_date ON ai_generation_log(created_at);

-- RLS: only the Edge Function (service_role) writes to ai_generation_log.
-- Anon users can read their own count for display purposes.
ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own generation log"
  ON ai_generation_log FOR SELECT
  USING (user_uid = auth.uid()::text);
```

- [ ] **Step 2: Apply the migration to Supabase**

Run in the Supabase dashboard SQL editor (or via `supabase db push` if CLI is set up). Verify both tables exist and RLS is enabled.

- [ ] **Step 3: Create the Storage bucket**

In Supabase dashboard → Storage → Create bucket:
- Name: `custom-icons`
- Public: yes (images served via public URL)
- File size limit: 2MB
- Allowed MIME types: `image/jpeg, image/png, image/webp`

Then add an RLS policy via SQL:

```sql
-- Storage RLS: list members can upload to their list's folder
CREATE POLICY "list members upload custom icons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );

CREATE POLICY "public read custom icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'custom-icons');

CREATE POLICY "list members delete custom icons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_custom_icons.sql
git commit -m "feat: add custom_icons and ai_generation_log tables with RLS"
```

---

## Task 2: Image Processing Utilities

**Files:**
- Create: `src/utils/image-utils.ts`
- Create: `tests/image-utils.test.ts`
- Modify: `package.json` (add dependency)

- [ ] **Step 1: Install browser-image-compression**

```bash
npm install browser-image-compression
```

- [ ] **Step 2: Write the failing tests**

```typescript
// tests/image-utils.test.ts
import { describe, test, expect } from 'vitest';
import { getAdaptiveLabel, detectLanguage } from '@/utils/image-utils';

describe('detectLanguage', () => {
  test('Chinese characters → zh', () => {
    expect(detectLanguage('椰浆')).toBe('zh');
  });

  test('English letters → en', () => {
    expect(detectLanguage('Salt')).toBe('en');
  });

  test('mixed defaults to zh if first char is CJK', () => {
    expect(detectLanguage('可乐Cola')).toBe('zh');
  });

  test('empty string → en', () => {
    expect(detectLanguage('')).toBe('en');
  });
});

describe('getAdaptiveLabel', () => {
  // Chinese rules: ≤3 chars full, 4+ → first 2
  test('1 Chinese char → full', () => {
    expect(getAdaptiveLabel('盐')).toBe('盐');
  });

  test('3 Chinese chars → full', () => {
    expect(getAdaptiveLabel('老干妈')).toBe('老干妈');
  });

  test('4 Chinese chars → first 2', () => {
    expect(getAdaptiveLabel('厨房纸巾')).toBe('厨房');
  });

  test('6 Chinese chars → first 2', () => {
    expect(getAdaptiveLabel('不锈钢百洁布')).toBe('不锈');
  });

  // English rules: ≤4 chars full, 5+ → first 3
  test('4 English chars → full', () => {
    expect(getAdaptiveLabel('Salt')).toBe('Salt');
  });

  test('5 English chars → first 3', () => {
    expect(getAdaptiveLabel('Towel')).toBe('Tow');
  });

  test('long English → first 3', () => {
    expect(getAdaptiveLabel('Shampoo')).toBe('Sha');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/image-utils.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement image-utils.ts**

```typescript
// src/utils/image-utils.ts
import imageCompression from 'browser-image-compression';

/**
 * Detect if text is primarily Chinese or English.
 */
export function detectLanguage(text: string): 'zh' | 'en' {
  if (!text) return 'en';
  // Check first character for CJK Unified Ideographs range
  const code = text.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) ? 'zh' : 'en';
}

/**
 * Get adaptive display label for watercolor fallback.
 * Chinese: ≤3 chars full, 4+ → first 2 chars
 * English: ≤4 chars full, 5+ → first 3 chars
 */
export function getAdaptiveLabel(name: string): string {
  if (!name) return '';
  const lang = detectLanguage(name);
  if (lang === 'zh') {
    return name.length <= 3 ? name : name.slice(0, 2);
  }
  return name.length <= 4 ? name : name.slice(0, 3);
}

/**
 * Crop an image file to a square, resize to 256x256, and compress to webp.
 * Returns a Blob ready for upload (≤200KB target).
 */
export async function processImageForUpload(file: File): Promise<Blob> {
  // Step 1: compress and resize using browser-image-compression
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2, // 200KB
    maxWidthOrHeight: 256,
    useWebWorker: true,
    fileType: 'image/webp',
  });
  return compressed;
}

/**
 * Draw image onto a square canvas (center-crop), return as Blob.
 * Used before compression when user hasn't manually cropped.
 */
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

/**
 * Sanitize item name for AI prompt: max 30 chars, strip dangerous patterns.
 */
export function sanitizeItemName(name: string): string {
  return name
    .trim()
    .slice(0, 30)
    .replace(/[<>{}[\]\\`$]/g, '');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/image-utils.test.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 6: Commit**

```bash
git add src/utils/image-utils.ts tests/image-utils.test.ts package.json package-lock.json
git commit -m "feat: add image processing utilities with adaptive label logic"
```

---

## Task 3: WatercolorFallback Component

**Files:**
- Create: `src/components/WatercolorFallback.tsx`
- Create: `tests/watercolor-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/watercolor-fallback.test.ts
import { describe, test, expect } from 'vitest';
import { getCategoryColor, CATEGORY_WATERCOLORS } from '@/components/WatercolorFallback';

describe('getCategoryColor', () => {
  test('蔬菜 returns green palette', () => {
    const color = getCategoryColor('蔬菜');
    expect(color.gradient).toContain('#a8d5a2');
  });

  test('肉蛋 returns warm palette', () => {
    const color = getCategoryColor('肉蛋');
    expect(color.gradient).toContain('#f0c9a0');
  });

  test('unknown category returns gray palette', () => {
    const color = getCategoryColor('未知类别');
    expect(color.gradient).toContain('#d5d0c8');
  });

  test('all 11 categories have colors defined', () => {
    const categories = ['蔬菜', '水果', '肉蛋', '乳制品', '主食', '烘焙', '调料', '零食', '饮料', '日用', '其他'];
    for (const cat of categories) {
      expect(CATEGORY_WATERCOLORS[cat]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/watercolor-fallback.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement WatercolorFallback component**

```tsx
// src/components/WatercolorFallback.tsx
import { getAdaptiveLabel } from '@/utils/image-utils';
import type { CategoryKey } from '@/types/item';

interface WatercolorColors {
  gradient: string;
  textColor: string;
}

export const CATEGORY_WATERCOLORS: Record<string, WatercolorColors> = {
  '蔬菜':   { gradient: 'radial-gradient(ellipse at 40% 40%, #a8d5a2 0%, #7ca982 60%, #5e9065 100%)', textColor: '#2d4a2d' },
  '水果':   { gradient: 'radial-gradient(ellipse at 42% 38%, #f5d4a0 0%, #e8b866 60%, #d4a040 100%)', textColor: '#5a4520' },
  '肉蛋':   { gradient: 'radial-gradient(ellipse at 45% 35%, #f0c9a0 0%, #c97b63 60%, #a85d45 100%)', textColor: '#4a2a1a' },
  '乳制品': { gradient: 'radial-gradient(ellipse at 40% 42%, #f5eed8 0%, #d4c9a8 60%, #c4b890 100%)', textColor: '#5a5030' },
  '主食':   { gradient: 'radial-gradient(ellipse at 38% 40%, #c8d5e8 0%, #8b9dc3 60%, #6a80a8 100%)', textColor: '#2a3550' },
  '烘焙':   { gradient: 'radial-gradient(ellipse at 44% 38%, #f0d4c0 0%, #c9886d 60%, #a86d52 100%)', textColor: '#4a2e20' },
  '调料':   { gradient: 'radial-gradient(ellipse at 40% 40%, #dcc8a0 0%, #b08d57 60%, #957540 100%)', textColor: '#3a2e15' },
  '零食':   { gradient: 'radial-gradient(ellipse at 42% 40%, #f0d8e0 0%, #d4a0b0 60%, #c08090 100%)', textColor: '#4a2030' },
  '饮料':   { gradient: 'radial-gradient(ellipse at 38% 42%, #a8c8e8 0%, #6a9ec4 60%, #4a7ea0 100%)', textColor: '#1e3a52' },
  '日用':   { gradient: 'radial-gradient(ellipse at 42% 38%, #d4b8d4 0%, #9b8ec0 60%, #7a70a0 100%)', textColor: '#3a2e52' },
  '其他':   { gradient: 'radial-gradient(ellipse at 40% 40%, #e8e2d8 0%, #d5d0c8 60%, #b8b0a5 100%)', textColor: '#4a4540' },
};

// Deterministic irregular blob shapes based on text hash
const BLOB_SHAPES = [
  '48% 52% 43% 57% / 52% 45% 55% 48%',
  '52% 48% 55% 45% / 45% 52% 48% 55%',
  '45% 55% 50% 50% / 55% 48% 52% 45%',
  '50% 50% 45% 55% / 48% 55% 45% 52%',
  '47% 53% 52% 48% / 53% 47% 50% 50%',
];

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(category: string): WatercolorColors {
  return CATEGORY_WATERCOLORS[category] ?? CATEGORY_WATERCOLORS['其他'];
}

interface Props {
  name: string;
  category: CategoryKey | string;
  size?: number; // px, default 48
}

export function WatercolorFallback({ name, category, size = 48 }: Props) {
  const label = getAdaptiveLabel(name);
  const colors = getCategoryColor(category);
  const shape = BLOB_SHAPES[hashCode(name) % BLOB_SHAPES.length];
  const fontSize = label.length <= 1 ? size * 0.45 : label.length <= 2 ? size * 0.36 : size * 0.28;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: shape,
        background: colors.gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.85,
        boxShadow: 'inset 0 -2px 6px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: colors.textColor,
          fontSize,
          fontFamily: "'Segoe Script', 'Comic Sans MS', cursive",
          fontWeight: 400,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/watercolor-fallback.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/WatercolorFallback.tsx tests/watercolor-fallback.test.ts
git commit -m "feat: add WatercolorFallback component replacing emoji fallback"
```

---

## Task 4: Custom Icons Client API & Hook

**Files:**
- Create: `src/lib/custom-icons.ts`
- Create: `src/hooks/useCustomIcons.ts`
- Create: `tests/custom-icons.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/custom-icons.test.ts
import { describe, test, expect } from 'vitest';
import { sanitizeItemName } from '@/utils/image-utils';
import { buildStoragePath, getPublicIconUrl } from '@/lib/custom-icons';

describe('buildStoragePath', () => {
  test('builds correct path', () => {
    const path = buildStoragePath('list-uuid-123', 'icon-uuid-456');
    expect(path).toBe('list-uuid-123/icon-uuid-456.webp');
  });
});

describe('getPublicIconUrl', () => {
  test('builds public URL from path', () => {
    const url = getPublicIconUrl('list-123/icon-456.webp');
    expect(url).toContain('/storage/v1/object/public/custom-icons/list-123/icon-456.webp');
  });
});

describe('sanitizeItemName (re-export test)', () => {
  test('strips dangerous chars', () => {
    expect(sanitizeItemName('test<script>alert')).toBe('testscriptalert');
  });

  test('trims to 30 chars', () => {
    const long = 'a'.repeat(50);
    expect(sanitizeItemName(long)).toHaveLength(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/custom-icons.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement custom-icons.ts**

```typescript
// src/lib/custom-icons.ts
import { supabase } from './supabase';

export interface CustomIcon {
  id: string;
  list_id: string;
  name: string;
  image_path: string;
  source: 'upload' | 'ai_generated' | 'ai_stylized';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'custom-icons';

export function buildStoragePath(listId: string, iconId: string): string {
  return `${listId}/${iconId}.webp`;
}

export function getPublicIconUrl(imagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

/** Fetch all custom icons for a list. */
export async function fetchCustomIcons(listId: string): Promise<CustomIcon[]> {
  const { data, error } = await supabase
    .from('custom_icons')
    .select('*')
    .eq('list_id', listId);
  if (error) throw error;
  return (data ?? []) as CustomIcon[];
}

/** Check if a custom icon already exists for this name in this list. */
export async function findExistingIcon(listId: string, name: string): Promise<CustomIcon | null> {
  const { data, error } = await supabase
    .from('custom_icons')
    .select('*')
    .eq('list_id', listId)
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data as CustomIcon | null;
}

/** Upload a processed image blob and create/upsert the custom_icons record. */
export async function uploadCustomIcon(
  listId: string,
  name: string,
  blob: Blob,
  source: CustomIcon['source'],
  createdBy: string
): Promise<CustomIcon> {
  const iconId = crypto.randomUUID();
  const storagePath = buildStoragePath(listId, iconId);

  // Delete old icon file if replacing
  const existing = await findExistingIcon(listId, name);
  if (existing) {
    await supabase.storage.from(BUCKET).remove([existing.image_path]);
  }

  // Upload to Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  // Upsert custom_icons record
  const { data, error: dbErr } = await supabase
    .from('custom_icons')
    .upsert(
      {
        list_id: listId,
        name,
        image_path: storagePath,
        source,
        created_by: createdBy,
      },
      { onConflict: 'list_id,name' }
    )
    .select()
    .single();
  if (dbErr) throw dbErr;
  return data as CustomIcon;
}

/** Delete a custom icon (record + storage file). */
export async function deleteCustomIcon(icon: CustomIcon): Promise<void> {
  await supabase.storage.from(BUCKET).remove([icon.image_path]);
  const { error } = await supabase
    .from('custom_icons')
    .delete()
    .eq('id', icon.id);
  if (error) throw error;
}

/** Call the generate-icon Edge Function. */
export async function generateIcon(
  name: string,
  listId: string,
  referenceImageBase64?: string
): Promise<{ image_url: string; remaining_today: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const body: Record<string, string> = { name, list_id: listId };
  if (referenceImageBase64) {
    body.reference_image = referenceImageBase64;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-icon`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (response.status === 429) {
    const err = await response.json();
    throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT', ...err });
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || 'Generation failed'), { code: 'GENERATION_FAILED' });
  }

  return response.json();
}

/** Get remaining AI generation credits for today. */
export async function getRemainingCredits(userUid: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_generation_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_uid', userUid)
    .gte('created_at', today.toISOString());

  if (error) throw error;
  return Math.max(0, 5 - (count ?? 0));
}
```

- [ ] **Step 4: Implement useCustomIcons hook**

```typescript
// src/hooks/useCustomIcons.ts
import { useEffect, useState, useCallback } from 'react';
import { fetchCustomIcons, getPublicIconUrl, type CustomIcon } from '@/lib/custom-icons';

/**
 * Hook that fetches custom icons for a list and builds a name→URL lookup map.
 * Returns the map and a refresh function.
 */
export function useCustomIcons(listId: string | null) {
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    try {
      const fetched = await fetchCustomIcons(listId);
      setIcons(fetched);
      const map = new Map<string, string>();
      for (const icon of fetched) {
        map.set(icon.name, getPublicIconUrl(icon.image_path));
      }
      setIconMap(map);
    } catch (err) {
      console.error('Failed to fetch custom icons:', err);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { iconMap, icons, loading, refresh };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/custom-icons.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/custom-icons.ts src/hooks/useCustomIcons.ts tests/custom-icons.test.ts
git commit -m "feat: add custom icons client API with upload, generate, and hook"
```

---

## Task 5: Update Icon Resolution (icon-registry + ItemRow)

**Files:**
- Modify: `src/utils/icon-registry.ts`
- Modify: `src/components/ItemRow.tsx`

- [ ] **Step 1: Update getIconPath to support custom icons**

In `src/utils/icon-registry.ts`, add an overload that accepts a custom icon map:

```typescript
// Add this new function after the existing getIconPath:

/**
 * Resolve icon URL with custom icon support.
 * Priority: preset icon → custom icon → null (caller renders WatercolorFallback)
 */
export function resolveIconUrl(
  name: string,
  customIconMap?: Map<string, string>
): string | null {
  // 1. Preset icon
  const preset = getIconPath(name);
  if (preset) return preset;

  // 2. Custom icon
  if (customIconMap) {
    const custom = customIconMap.get(name);
    if (custom) return custom;
  }

  // 3. No match — caller should render WatercolorFallback
  return null;
}
```

- [ ] **Step 2: Update ItemRow to use WatercolorFallback**

Replace the emoji fallback in `src/components/ItemRow.tsx`:

Change the import section to:
```typescript
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import type { Item } from '@/types/item';
```

Change the Props interface to accept `customIconMap`:
```typescript
interface Props {
  item: Item;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}
```

Update the component function signature and icon resolution:
```typescript
export function ItemRow({ item, customIconMap, onToggle, onMenu }: Props) {
  const checked = item.checked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item }
  });
  const iconUrl = resolveIconUrl(item.name, customIconMap);
  const [iconErr, setIconErr] = useState(false);
  const hasIcon = iconUrl && !iconErr;
```

Replace the icon/emoji rendering block (the `<div>` containing the icon or emoji) with:
```tsx
      {/* icon or watercolor fallback */}
      <div
        className={`shrink-0 flex items-center justify-center rounded-xl ${
          checked ? 'opacity-40 grayscale' : ''
        }`}
        style={{
          width: hasIcon ? 56 : 48,
          height: hasIcon ? 56 : 48,
          background: hasIcon ? 'rgba(255,252,247,0.5)' : 'transparent',
          border: hasIcon ? '1px solid rgba(215,205,188,0.3)' : 'none',
        }}
      >
        {hasIcon ? (
          <img
            src={iconUrl}
            alt=""
            className="w-full h-full object-contain rounded-xl p-1"
            style={{ mixBlendMode: 'multiply' }}
            onError={() => setIconErr(true)}
          />
        ) : (
          <WatercolorFallback name={item.name} category={item.category} size={48} />
        )}
      </div>
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/icon-registry.ts src/components/ItemRow.tsx
git commit -m "feat: integrate custom icons and watercolor fallback into ItemRow"
```

---

## Task 6: IconPickerPanel Component

**Files:**
- Create: `src/components/IconPickerPanel.tsx`

- [ ] **Step 1: Implement IconPickerPanel**

This component appears inside AddSheet when a typed item name has no preset icon match.

```tsx
// src/components/IconPickerPanel.tsx
import { useState } from 'react';
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
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/IconPickerPanel.tsx
git commit -m "feat: add IconPickerPanel with upload/AI/skip options"
```

---

## Task 7: AiPreviewModal Component

**Files:**
- Create: `src/components/AiPreviewModal.tsx`

- [ ] **Step 1: Implement AiPreviewModal**

```tsx
// src/components/AiPreviewModal.tsx
import { useState } from 'react';

interface Props {
  open: boolean;
  itemName: string;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  remainingCredits: number;
  onAccept: () => void;
  onRetry: () => void;
  onSkip: () => void;
  /** Show "watercolor-ify" button for uploaded photos */
  showStylize?: boolean;
  onStylize?: () => void;
}

export function AiPreviewModal({
  open,
  itemName,
  imageUrl,
  loading,
  error,
  remainingCredits,
  onAccept,
  onRetry,
  onSkip,
  showStylize,
  onStylize,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="rounded-3xl p-6 mx-6 w-full max-w-sm"
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div className="text-center mb-4">
          <div className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
            {loading ? '正在生成...' : error ? '生成失败' : `「${itemName}」`}
          </div>
        </div>

        {/* Preview area */}
        <div
          className="flex items-center justify-center rounded-2xl mb-4 overflow-hidden"
          style={{
            width: '100%',
            aspectRatio: '1',
            background: 'rgba(255,252,247,0.8)',
            border: '1px solid rgba(215,205,188,0.3)',
          }}
        >
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-12 h-12 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(ellipse at 40% 40%, #a8d5a2 0%, #7ca982 60%)',
                  opacity: 0.6,
                }}
              />
              <span className="text-xs" style={{ color: '#a0937e' }}>AI 正在绘制...</span>
            </div>
          )}
          {error && (
            <div className="text-center px-4">
              <span className="text-2xl mb-2 block">😅</span>
              <span className="text-xs" style={{ color: '#c97b63' }}>{error}</span>
            </div>
          )}
          {imageUrl && !loading && !error && (
            <img
              src={imageUrl}
              alt={itemName}
              className="w-full h-full object-contain p-4"
              style={{ mixBlendMode: 'multiply' }}
            />
          )}
        </div>

        {/* Credits counter */}
        <div className="text-center mb-4">
          <span className="text-[10px]" style={{ color: '#a0937e' }}>
            剩余今日额度：{remainingCredits}/5 次
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {imageUrl && !loading && !error && (
            <button
              onClick={onAccept}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white active:opacity-80"
              style={{ background: '#7ca982' }}
            >
              采用 ✓
            </button>
          )}

          {!loading && (
            <button
              onClick={onRetry}
              disabled={remainingCredits <= 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium active:opacity-80 disabled:opacity-40"
              style={{
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.4)',
                color: '#5a4e3c',
              }}
            >
              {error ? '重试' : '重试 ↻'}
            </button>
          )}

          <button
            onClick={onSkip}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium active:opacity-80"
            style={{
              background: 'rgba(255,252,247,0.8)',
              border: '1px solid rgba(215,205,188,0.4)',
              color: '#a0937e',
            }}
          >
            先跳过
          </button>
        </div>

        {/* Stylize button for uploaded photos */}
        {showStylize && imageUrl && !loading && !error && (
          <button
            onClick={onStylize}
            disabled={remainingCredits <= 0}
            className="w-full mt-2 py-2 rounded-xl text-xs font-medium active:opacity-80 disabled:opacity-40"
            style={{
              background: 'rgba(124,169,130,0.1)',
              border: '1px solid rgba(124,169,130,0.3)',
              color: '#5e8a65',
            }}
          >
            🎨 转为手绘风格（消耗 1 次额度）
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AiPreviewModal.tsx
git commit -m "feat: add AiPreviewModal with accept/retry/skip/stylize actions"
```

---

## Task 8: Integrate Custom Items into AddSheet

**Files:**
- Modify: `src/components/AddSheet.tsx`

This is the largest frontend change. AddSheet needs to:
1. Accept `listId` and custom icon hooks
2. Detect when typed item has no preset match
3. Show IconPickerPanel with upload/AI/skip
4. Handle file upload + crop + compress
5. Handle AI generation flow with AiPreviewModal
6. Handle same-name conflict resolution

- [ ] **Step 1: Update AddSheet props and imports**

Add to the import section of `src/components/AddSheet.tsx`:

```typescript
import { IconPickerPanel } from '@/components/IconPickerPanel';
import { AiPreviewModal } from '@/components/AiPreviewModal';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { cropToSquare, processImageForUpload, sanitizeItemName } from '@/utils/image-utils';
import { uploadCustomIcon, generateIcon, findExistingIcon, getRemainingCredits } from '@/lib/custom-icons';
```

Update the Props interface:

```typescript
interface Props {
  open: boolean;
  uid: string;
  listId: string;  // NEW
  supermarkets: Supermarket[];
  customIconMap: Map<string, string>;  // NEW
  onClose: () => void;
  onAdd: (input: NewItemInput) => Promise<string>;
  onRemove: (itemId: string) => Promise<void>;
  onIconsChanged: () => void;  // NEW — triggers useCustomIcons refresh
}
```

- [ ] **Step 2: Add custom icon state and handlers**

Add these state variables inside the `AddSheet` component function, after the existing state declarations:

```typescript
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');
  const [pendingCategory, setPendingCategory] = useState<CategoryKey>('其他');
  const [remainingCredits, setRemainingCredits] = useState(5);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [showStylize, setShowStylize] = useState(false);
```

Add a credits-fetching effect inside the `useEffect` that runs when `open` changes:

```typescript
  useEffect(() => {
    if (open) {
      // ... existing reset code ...
      getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
    }
  }, [open, uid]);
```

- [ ] **Step 3: Update submitTyped to detect missing icons**

Replace the existing `submitTyped` function:

```typescript
  const submitTyped = () => {
    const name = value.trim();
    if (!name) return;
    const m = matchCategory(name);

    // Check if preset or custom icon exists
    const hasPreset = UNIQUE_ICON_ITEMS.some(
      i => i.name === name || i.aliases?.includes(name) || name.includes(i.name) || i.name.includes(name)
    );
    const hasCustom = customIconMap.has(name);

    if (!hasPreset && !hasCustom) {
      // Show icon picker panel
      setPendingItemName(name);
      setPendingCategory(m.category as CategoryKey);
      setShowIconPicker(true);
      return;
    }

    // Has icon — add directly
    toggleItem(name, {
      name, note: '', quantity: '',
      supermarket: selectedMarket,
      category: m.category as CategoryKey,
      category_emoji: m.emoji
    });
    setValue('');
  };
```

- [ ] **Step 4: Add icon picker handlers**

Add these handler functions inside the component:

```typescript
  const handleSkipIcon = () => {
    const m = matchCategory(pendingItemName);
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setShowIconPicker(false);
    setPendingItemName('');
    setValue('');
  };

  const handleUploadPhoto = () => {
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

        // Check for existing icon with same name
        const existing = await findExistingIcon(listId, pendingItemName);
        if (existing) {
          const confirmReplace = window.confirm(`「${pendingItemName}」已有自定义图标，要替换吗？`);
          if (!confirmReplace) return;
        }

        await uploadCustomIcon(listId, pendingItemName, compressed, 'upload', uid);
        onIconsChanged();

        // Show preview with stylize option
        setUploadedPreviewUrl(URL.createObjectURL(compressed));
        setShowStylize(true);
        setAiModalOpen(true);
        setShowIconPicker(false);
      } catch (err) {
        console.error('Upload failed:', err);
        alert('上传失败，请重试');
      }
    };
    input.click();
  };

  const handleAiGenerate = async (referenceImageBase64?: string) => {
    setAiModalOpen(true);
    setShowIconPicker(false);
    setAiLoading(true);
    setAiError(null);
    setAiImageUrl(null);
    setShowStylize(false);

    try {
      const sanitized = sanitizeItemName(pendingItemName);
      const result = await generateIcon(sanitized, listId, referenceImageBase64);
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

  const handleAiAccept = () => {
    // Icon already saved by Edge Function, just add the item
    const m = matchCategory(pendingItemName);
    onIconsChanged();
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setAiModalOpen(false);
    setPendingItemName('');
    setValue('');
  };

  const handleUploadAccept = () => {
    // Photo already uploaded, just add the item
    const m = matchCategory(pendingItemName);
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setAiModalOpen(false);
    setUploadedPreviewUrl(null);
    setShowStylize(false);
    setPendingItemName('');
    setValue('');
  };

  const handleStylize = async () => {
    if (!uploadedPreviewUrl) return;
    // Convert the uploaded image to base64 for the reference image prompt
    try {
      const response = await fetch(uploadedPreviewUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
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
    handleSkipIcon();
    setAiModalOpen(false);
  };
```

- [ ] **Step 5: Add IconPickerPanel and AiPreviewModal to JSX**

In the AddSheet JSX, add the IconPickerPanel right before the `{/* no results */}` section:

```tsx
          {/* custom icon picker */}
          {showIconPicker && pendingItemName && (
            <IconPickerPanel
              itemName={pendingItemName}
              category={pendingCategory}
              remainingCredits={remainingCredits}
              onUpload={handleUploadPhoto}
              onAiGenerate={() => handleAiGenerate()}
              onSkip={handleSkipIcon}
            />
          )}
```

Add the AiPreviewModal at the very end of the component return, just before the closing `</div>`:

```tsx
      {/* AI preview modal */}
      <AiPreviewModal
        open={aiModalOpen}
        itemName={pendingItemName}
        imageUrl={uploadedPreviewUrl ?? aiImageUrl}
        loading={aiLoading}
        error={aiError}
        remainingCredits={remainingCredits}
        onAccept={uploadedPreviewUrl ? handleUploadAccept : handleAiAccept}
        onRetry={() => handleAiGenerate()}
        onSkip={handleAiSkip}
        showStylize={showStylize}
        onStylize={handleStylize}
      />
```

- [ ] **Step 6: Update AddSheet callers to pass new props**

Find where `<AddSheet>` is rendered (in `src/routes/List.tsx`) and pass the new props: `listId`, `customIconMap`, and `onIconsChanged`. The List route needs to use `useCustomIcons` hook:

```typescript
// Add to imports in List.tsx:
import { useCustomIcons } from '@/hooks/useCustomIcons';

// Inside the List component, after useItems:
const { iconMap: customIconMap, refresh: refreshIcons } = useCustomIcons(listId);

// Update AddSheet usage:
<AddSheet
  open={addOpen}
  uid={uid}
  listId={listId}         // NEW
  supermarkets={supermarkets}
  customIconMap={customIconMap}  // NEW
  onClose={() => setAddOpen(false)}
  onAdd={handleAdd}
  onRemove={handleRemove}
  onIconsChanged={refreshIcons}  // NEW
/>

// Update ItemRow usage to pass customIconMap:
<ItemRow
  item={item}
  customIconMap={customIconMap}  // NEW
  onToggle={handleToggle}
  onMenu={handleMenu}
/>
```

- [ ] **Step 7: Update AddSheet emoji fallback in existing icon grid**

In AddSheet, update the frequent items and icon grid to use `WatercolorFallback` instead of emoji when an icon file is missing. Replace the emoji `<span>` fallbacks:

In the frequent items section, replace:
```tsx
<span className="text-2xl" style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>{f.category_emoji}</span>
```
with:
```tsx
<div style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
  <WatercolorFallback name={f.name} category={f.category_emoji === '📦' ? '其他' : '其他'} size={40} />
</div>
```

In the icon grid, replace the `📦` fallback:
```tsx
<span className="text-3xl" style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>📦</span>
```
with:
```tsx
<div style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
  <WatercolorFallback name={item.name} category={item.category} size={56} />
</div>
```

- [ ] **Step 8: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/components/AddSheet.tsx src/routes/List.tsx
git commit -m "feat: integrate custom icon upload and AI generation into AddSheet"
```

---

## Task 9: Supabase Edge Function — generate-icon

**Files:**
- Create: `supabase/functions/generate-icon/index.ts`

- [ ] **Step 1: Create the Edge Function directory**

```bash
mkdir -p supabase/functions/generate-icon
```

- [ ] **Step 2: Implement the Edge Function**

```typescript
// supabase/functions/generate-icon/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const DAILY_PER_USER_LIMIT = 5;
const DAILY_GLOBAL_LIMIT = 100;
const BUCKET = 'custom-icons';

const PROMPT_WITHOUT_REF = `生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形，无文字无装饰无阴影
- 包装上不要出现任何文字和 logo`;

const PROMPT_WITH_REF = `生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形`;

function sanitize(name: string): string {
  return name.trim().slice(0, 30).replace(/[<>{}[\]\\`$]/g, '');
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const userUid = user.id;

    // 2. Parse body
    const { name, list_id, reference_image } = await req.json();
    if (!name || !list_id) {
      return new Response(JSON.stringify({ error: 'invalid_input', message: 'name and list_id required' }), { status: 400 });
    }
    const sanitizedName = sanitize(name);
    if (!sanitizedName) {
      return new Response(JSON.stringify({ error: 'invalid_input', message: 'Invalid item name' }), { status: 400 });
    }

    // 3. Verify user is member of list
    const { data: list } = await supabaseUser
      .from('lists')
      .select('id')
      .eq('id', list_id)
      .contains('member_uids', [userUid])
      .maybeSingle();
    if (!list) {
      return new Response(JSON.stringify({ error: 'Not a member of this list' }), { status: 403 });
    }

    // 4. Check rate limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { count: userCount } = await supabaseUser
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_uid', userUid)
      .gte('created_at', todayISO);

    if ((userCount ?? 0) >= DAILY_PER_USER_LIMIT) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return new Response(JSON.stringify({
        error: 'limit_exceeded',
        remaining_today: 0,
        reset_at: tomorrow.toISOString(),
      }), { status: 429 });
    }

    const { count: globalCount } = await supabaseUser
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    if ((globalCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return new Response(JSON.stringify({
        error: 'limit_exceeded',
        remaining_today: 0,
        message: 'Global daily limit reached',
      }), { status: 429 });
    }

    // 5. Build prompt and call Gemini Imagen API
    const promptTemplate = reference_image ? PROMPT_WITH_REF : PROMPT_WITHOUT_REF;
    const prompt = promptTemplate.replace('{item_name}', sanitizedName);

    const geminiBody: Record<string, unknown> = {
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
      },
    };

    // If reference image provided, use image editing endpoint
    const geminiEndpoint = reference_image
      ? `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`
      : `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;

    const geminiPayload: Record<string, unknown> = {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1' },
    };

    if (reference_image) {
      (geminiPayload.instances as Record<string, unknown>[])[0].image = {
        bytesBase64Encoded: reference_image,
      };
    }

    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'generation_failed', message: 'AI generation failed' }), { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const imageBase64 = geminiData.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'generation_failed', message: 'No image returned' }), { status: 502 });
    }

    // 6. Convert base64 to binary
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

    // 7. Upload to Storage
    const iconId = crypto.randomUUID();
    const storagePath = `${list_id}/${iconId}.webp`;

    // Delete old icon if exists
    const { data: existingIcon } = await supabaseUser
      .from('custom_icons')
      .select('image_path')
      .eq('list_id', list_id)
      .eq('name', sanitizedName)
      .maybeSingle();

    if (existingIcon) {
      await supabaseUser.storage.from(BUCKET).remove([existingIcon.image_path]);
    }

    const { error: uploadErr } = await supabaseUser.storage
      .from(BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: 'image/webp',
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    // 8. Upsert custom_icons record
    const source = reference_image ? 'ai_stylized' : 'ai_generated';
    await supabaseUser
      .from('custom_icons')
      .upsert(
        { list_id, name: sanitizedName, image_path: storagePath, source, created_by: userUid },
        { onConflict: 'list_id,name' }
      );

    // 9. Log generation (only on success)
    await supabaseUser
      .from('ai_generation_log')
      .insert({ user_uid: userUid, item_name: sanitizedName });

    // 10. Return public URL
    const { data: urlData } = supabaseUser.storage.from(BUCKET).getPublicUrl(storagePath);

    const remaining = DAILY_PER_USER_LIMIT - (userCount ?? 0) - 1;

    return new Response(JSON.stringify({
      image_url: urlData.publicUrl,
      remaining_today: Math.max(0, remaining),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: (err as Error).message }), { status: 500 });
  }
});
```

- [ ] **Step 3: Set the GEMINI_API_KEY secret**

In the Supabase dashboard → Edge Functions → Secrets, add:
- `GEMINI_API_KEY`: your Gemini API key from Google AI Studio

- [ ] **Step 4: Deploy the Edge Function**

```bash
npx supabase functions deploy generate-icon --no-verify-jwt
```

Note: `--no-verify-jwt` because we do JWT verification manually inside the function (to extract user info). Supabase still passes the JWT header through.

- [ ] **Step 5: Test manually**

Use curl or the app to send a test request. Verify:
- 200 response with `image_url` and `remaining_today`
- Image appears in Supabase Storage under `custom-icons/{list_id}/`
- Record appears in `custom_icons` table
- Log entry appears in `ai_generation_log`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-icon/index.ts
git commit -m "feat: add generate-icon Edge Function with Gemini Imagen integration"
```

---

## Task 10: PWA Offline Caching for Custom Icons

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add runtime caching rule for custom icons**

In `vite.config.ts`, add a second entry to the `runtimeCaching` array inside the VitePWA config:

```typescript
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 3
            }
          },
          // NEW: Cache custom icons for offline use
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/custom-icons\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'custom-icons',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ]
```

**Important:** The custom-icons rule must come BEFORE the general supabase rule in the array, because Workbox matches the first matching pattern. Reorder so the more specific pattern is first:

```typescript
        runtimeCaching: [
          // Specific: custom icons — cache-first for offline
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/custom-icons\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'custom-icons',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // General: Supabase API — network-first
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 3
            }
          },
        ]
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: Build succeeds, service worker generated with both caching rules.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add CacheFirst PWA caching for custom icon images"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: All tests pass (existing + new).

- [ ] **Step 2: Run type checking**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Build the app**

```bash
npm run build
```

Expected: Successful build with no warnings.

- [ ] **Step 4: Manual E2E verification**

Run `npm run dev` and test these flows in the browser:

1. **Watercolor fallback:** Type a custom item name (e.g. "椰浆") → press Enter or click "添加" → verify watercolor text fallback appears instead of emoji
2. **Upload flow:** Type custom name → click "上传照片" → select an image → verify it appears as the item's icon
3. **AI generation flow:** Type custom name → click "AI 生成" → wait for preview → click "采用" → verify icon saved
4. **AI retry:** Generate → click "重试" → verify new image, credit decremented
5. **Stylize flow:** Upload photo → click "转为手绘风格" → verify watercolored version
6. **Rate limiting:** Generate 5 times → verify "今日已用完" message
7. **Same-name conflict:** Upload icon for "椰浆" → upload again for "椰浆" → verify confirmation dialog
8. **Family sharing:** Open list on second device/browser → verify custom icons visible
9. **Offline:** Load page with custom icons → go offline → refresh → verify icons still load from cache

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete custom items with upload, AI generation, and watercolor fallback"
```
