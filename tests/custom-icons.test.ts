// tests/custom-icons.test.ts
import { describe, test, expect, vi } from 'vitest';
import { sanitizeItemName } from '@/utils/image-utils';

// Mock the supabase client BEFORE importing the module under test
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/custom-icons/${path}` }
        })
      })
    }
  }
}));

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
