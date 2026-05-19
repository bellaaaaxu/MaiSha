# Custom Items: User Upload & AI Icon Generation

## Overview

Allow users to add custom items beyond the preset library (77 items), with two image options: upload a photo or generate a hand-drawn watercolor style icon via AI. All custom items and icons are shared with family members on the same list.

## Architecture: Approach A — Edge Function Proxy

```
Frontend (React)
    ├── Upload photo → crop/resize/compress → Supabase Storage
    └── AI generate → Supabase Edge Function → Gemini Imagen API → Supabase Storage
                                                                         ↓
                                                                  custom_icons table
                                                                         ↓
                                                              Shared via list_id (RLS)
```

No additional backend services. Everything runs on the existing Supabase infrastructure.

---

## 1. Security

| Layer | Measure |
|-------|---------|
| API Key | Gemini API key stored only in Edge Function env vars, never reaches the client |
| Auth | Edge Function validates Supabase JWT; unauthenticated requests rejected |
| Upload limits | Accept only image/jpeg, image/png, image/webp; max 2MB per file |
| Storage RLS | Supabase Storage bucket policy: only list members can read/write icons for their list |
| Input sanitization | Item name max 30 characters, stripped of special characters; prevents prompt injection |
| Prompt template | Hardcoded on server; user can only inject `item_name` and optionally a reference image |

## 2. Cost Control (Triple Protection)

| Control | Mechanism | Detail |
|---------|-----------|--------|
| Per-user daily limit | 5 generations/user/day | Edge Function queries `ai_generation_log` before each generation |
| Global daily limit | 100 generations/day total | Shared counter across all users; breaker trips when reached |
| Google Cloud budget | Billing alert + hard quota in Google Cloud Console | Failsafe even if code bugs cause runaway requests |

**Cost estimate:** 50 users × 2 generations/day = 100/day × $0.03 ≈ $3/day ≈ $90/month ceiling. Actual usage expected much lower since most common items already have preset icons.

## 3. Data Model

### New table: `custom_icons`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `list_id` | uuid (FK → lists) | Sharing boundary — all list members see these icons |
| `name` | text | Item name, used as the matching key (e.g. "椰浆") |
| `image_path` | text | Path in Supabase Storage |
| `source` | text | `'upload'`, `'ai_generated'`, or `'ai_stylized'` (photo → watercolor conversion) |
| `created_by` | text | Creator's UID |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Updated on upsert (trigger) |

**Unique constraint:** `(list_id, name)` — one icon per item name per list. Creating a new icon for an existing name overwrites it (with confirmation prompt).

### New table: `ai_generation_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_uid` | text | Requester |
| `item_name` | text | Generated item name |
| `created_at` | timestamptz | Used for daily count queries |

### Storage bucket: `custom-icons`

```
custom-icons/
  └── {list_id}/
      └── {icon_id}.webp     ← All images converted to webp for size consistency
```

RLS policy: user must be owner or member of the list to read/write.

## 4. Icon Lookup Priority

When rendering an item, `getIconPath` resolves in this order:

```
1. Preset icons (icon-registry.ts, 77 items)  ← exact match / alias match
2. custom_icons table (by list_id + name)       ← NEW
3. Watercolor text fallback                     ← CHANGED from emoji
```

### Fallback: Adaptive Watercolor Text

Replaces the current category emoji fallback. Renders the item name (or a truncated form) on a watercolor blob background with category-based color.

**Adaptive text rules:**

| Language | Short (full text) | Long (truncated) |
|----------|-------------------|-------------------|
| Chinese | ≤3 characters (盐, 老干妈) | 4+ characters → first 2 characters (厨房纸巾 → 厨房) |
| English | ≤4 characters (Salt, Milk) | 5+ characters → first 3 characters (Towel → Tow) |

**Category color mapping:** Each of the 11 categories maps to a distinct pastel watercolor color (green for 蔬菜, warm brown for 肉蛋, blue for 日用, etc.).

The watercolor blob uses irregular `border-radius` values and `radial-gradient` to simulate a hand-painted texture, matching the app's illustration style.

## 5. UI Flow: Adding Custom Items

### Entry point: AddSheet (inline, no page navigation)

When a user types an item name in AddSheet that has no preset icon match:

```
┌─────────────────────────────────────────┐
│  没有找到「椰浆」的预设图标               │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   📷     │ │   🎨     │ │   椰     │ │
│  │ 上传照片  │ │ AI 生成  │ │  先跳过   │ │
│  │          │ │ 剩余4/5次│ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

Three options:
1. **上传照片** — Opens camera/gallery picker → frontend crops to square, resizes to 256×256, compresses to webp (≤200KB) → uploads to Supabase Storage → writes to `custom_icons` table
2. **AI 生成** — Shows remaining daily credits → optionally upload reference photo → calls Edge Function → **shows preview** → user confirms "采用" or "重试" → saves on confirm only
3. **先跳过** — Uses watercolor text fallback; item is added immediately without an icon

### Upload preprocessing (client-side)

1. User selects image from camera or gallery
2. Crop UI: square crop overlay, user can pan/zoom
3. Resize to 256×256
4. Compress to webp, target ≤200KB
5. Upload to Supabase Storage
6. Write `custom_icons` record with `source: 'upload'`

### "Watercolor-ify" uploaded photo

After uploading a real photo, user sees an additional button: **「转为手绘风格」**. This sends the uploaded photo as a reference image to the AI generation endpoint, using the reference-image prompt template. The result replaces the original upload. Counts as one AI generation credit.

## 6. AI Generation Pipeline

### Edge Function: `generate-icon`

```
POST /functions/v1/generate-icon
Headers: Authorization: Bearer <supabase_jwt>
Body: {
  name: string,          // item name, max 30 chars
  list_id: string,       // target list UUID
  reference_image?: string  // optional base64 of reference photo
}

Response 200: { image_url: string, remaining_today: number }
Response 429: { error: "limit_exceeded", remaining_today: 0, reset_at: string }
Response 400: { error: "invalid_input", message: string }
```

### Execution flow

1. Validate JWT → extract `user_uid`
2. Verify user is member of `list_id`
3. Check `ai_generation_log`: per-user count today < 5, global count today < 100
4. If limit exceeded → return 429
5. Select prompt template based on whether `reference_image` is present
6. Call Gemini Imagen API
7. Compress result to webp (≤200KB, 256×256)
8. Upload to Supabase Storage: `custom-icons/{list_id}/{icon_id}.webp`
9. Upsert `custom_icons` record (upsert on `list_id + name`)
10. Insert `ai_generation_log` record
11. Return `{ image_url, remaining_today }`

### Prompt templates (hardcoded in Edge Function)

**Without reference image:**

```
生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形，无文字无装饰无阴影
- 包装上不要出现任何文字和 logo
```

**With reference image:**

```
生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形
```

### AI preview and confirmation

The AI generation result is shown as a preview before saving:

```
┌──────────────────────────────┐
│      [generated image]       │
│                              │
│   ┌────────┐  ┌────────┐    │
│   │  采用 ✓ │  │ 重试 ↻ │    │
│   └────────┘  └────────┘    │
│                              │
│   剩余今日额度：3/5 次        │
└──────────────────────────────┘
```

- **采用**: saves the image, writes to DB, closes preview
- **重试**: discards current image, generates a new one (costs 1 additional credit)
- If daily limit reached during retry, disable the retry button and show message

### Error handling

If the AI generation call fails (network error, API error, content filter rejection):

1. **Do not count** the failed attempt against the user's daily limit (`ai_generation_log` is only written on success)
2. Show a brief error message: "生成失败，请稍后重试"
3. Offer two options: **重试** (try again) or **先跳过** (use text fallback)
4. The item addition flow is never blocked by a generation failure

## 7. Offline Support (PWA)

The current service worker (vite-plugin-pwa, Workbox) caches preset icons from `/public/icons/`. Custom icons from Supabase Storage URLs are not cached by default.

**Solution:** Add a runtime caching rule in the Workbox config for the Supabase Storage domain:

```
Strategy: CacheFirst
URL pattern: https://<supabase-project>.supabase.co/storage/v1/object/public/custom-icons/**
Max entries: 200
Max age: 30 days
```

This ensures custom icons load offline after being viewed once. The 200-entry cap prevents unbounded cache growth.

## 8. Same-Name Conflict Resolution

When a user creates a custom icon for an item name that already has one in the same list:

1. Show the existing icon with a prompt: "「椰浆」已有自定义图标，要替换吗？"
2. User confirms → upsert overwrites the old record; old image file deleted from Storage
3. User cancels → keeps existing icon

This is simple and appropriate for a family-shared list where members trust each other.

---

## Future Consideration: Popular Items Analytics

_Not in scope for this implementation, noted for future reference._

Run periodic queries on `custom_icons` to identify item names that appear across many different lists. High-frequency items are candidates for promotion to the preset icon library (manually curated). This reduces AI generation costs over time and improves the out-of-box experience.

Example query:
```sql
SELECT name, COUNT(DISTINCT list_id) as list_count
FROM custom_icons
GROUP BY name
ORDER BY list_count DESC
LIMIT 20;
```
