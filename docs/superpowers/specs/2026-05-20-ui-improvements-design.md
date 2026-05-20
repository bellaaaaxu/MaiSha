# UI/UX Improvements: Header Redesign, Icon Library, Image Preview

## Overview

Three connected UI/UX improvements to make MaiSha feel more like a native app:

1. **Header redesign** — replace the small ⋯ menu with visible icon buttons
2. **Icon library page** — dedicated screen for managing custom icons
3. **Long-press image preview** — let users see icons enlarged in AddSheet without committing to add

---

## 1. Header Redesign

### Current state

```
[ 买啥 / 共享·5项待买 ]        [📤] [⋯]
```

The ⋯ opens a bottom sheet (MoreMenu) with: 复制清单文本 / 管理超市 / 设置. Users don't discover it.

### New state

```
[ 买啥 / 共享·5项待买 ]   [🎨] [📤] [⚙️]
```

Three visible buttons replace ⋯:
- **🎨** — opens new `/icons` route (icon library)
- **📤** — share (existing functionality)
- **⚙️** — opens settings/more menu

Each button is a tappable pill with hover state. The old MoreMenu becomes just the ⚙️ menu (or directly navigates to /settings).

### Implementation

Modify `src/routes/List.tsx` header. Replace this block:
```tsx
<button onClick={onShareMenu}>📤</button>
<button onClick={() => setShowMore(true)}>⋯</button>
```

with three styled buttons. The 🎨 button navigates to `/icons` (new route).

---

## 2. Icon Library Page

### Route

`/icons` — new route registered in `App.tsx` router.

### Layout (List view with metadata — Option D from design)

```
┌─────────────────────────────┐
│ ← 我的图标          [+ 新增] │
├─────────────────────────────┤
│ ┌───┐ 椰浆                   │
│ │   │ AI 生成 · 3天前    ⋮  │
│ └───┘                        │
│ ┌───┐ 老干妈                 │
│ │   │ 📷 上传 · 1周前   ⋮  │
│ └───┘                        │
│ ...                          │
└─────────────────────────────┘
```

### Component structure

- Header: back arrow + title + "+ 新增" button
- Empty state: 🎨 icon + "还没有自定义图标" + "新增第一个" CTA
- Loading state: skeleton rows
- List: each row shows icon thumbnail (56×56) + name + source/date + ⋮ menu

### Row metadata format

- Source label:
  - `AI 生成` for `source === 'ai_generated'`
  - `📷 上传` for `source === 'upload'`
  - `🎨 AI 水彩化` for `source === 'ai_stylized'`
- Date: relative time ("3天前", "1周前", "刚刚")

### Per-row ⋮ menu

Tap ⋮ opens bottom sheet with:
- **🔄 重新生成** (AI flow with same name)
- **🗑️ 删除图标** (with confirm)

Tapping the row itself (not ⋮) opens a large preview modal showing the full image.

### "+ 新增" flow

Click "+ 新增" → bottom sheet:

```
┌─────────────────────────────┐
│ 新增图标                     │
│                              │
│ 输入物品名：                  │
│ [____________________]       │
│                              │
│        [取消] [下一步]        │
└─────────────────────────────┘
```

1. User types name
2. Click "下一步"
3. **Preset check**: if `getIconPath(name)` returns a preset, show confirm:
   > 「老干妈」已有预设图标，自定义图标会替换显示。继续吗？
   > [取消] [继续]
4. Then show IconPickerPanel (upload/AI) — reuse existing component
5. On completion → close sheet → icon appears in library list

### Data flow

- Uses existing `useCustomIcons(listId)` hook for list data
- Uses existing `uploadCustomIcon`, `generateIcon`, `deleteCustomIcon` from `src/lib/custom-icons.ts`
- New helpers needed: formatRelativeDate, formatSourceLabel

---

## 3. Long-Press Image Preview (in AddSheet)

### Behavior

| User action | Result |
|-------------|--------|
| Tap (< 400ms hold) | Add/remove item (existing behavior) |
| Press and hold ≥ 400ms | Show preview overlay |
| Move finger > 8px during hold | Cancel — no preview, no add |
| Hold then release | Close preview, no add |
| Hold then drag out | Cancel preview |

### Visual feedback states

1. **0-200ms**: no change (normal tap window)
2. **200-400ms**: card scales to 0.95 with `transition: 200ms ease`  — subtle "press registered" feedback
3. **400ms+**: preview overlay fades in (200ms), original card returns to scale 1

### Preview overlay design

A small centered popover, not full-screen:

```
   ┌──────────────────┐
   │                  │
   │    [big icon]    │  ← 160×160
   │                  │
   │    西红柿         │
   │  蔬菜·预设图标   │
   └──────────────────┘
```

- Centered on screen, semi-transparent backdrop
- No "添加" button (keeps it preview-only — adds on regular tap)
- Closes when pointer is released anywhere
- Fades out in 150ms

### Discoverability

First time user opens AddSheet, show toast at bottom of sheet:

> 💡 长按图标可预览大图

- Stored in localStorage: `maisha:preview-hint-seen` (boolean)
- Auto-dismisses after 4 seconds
- One-time only

### Implementation

New hook `useLongPress`:
```typescript
function useLongPress(
  onLongPress: () => void,
  options?: { threshold?: number; moveTolerance?: number; onCancel?: () => void }
): { onPointerDown, onPointerUp, onPointerMove, onPointerCancel, isPressing }
```

Use this hook in AddSheet's icon grid buttons. Existing onClick remains for tap = add/remove.

New component `IconPreviewOverlay`:
```typescript
interface Props {
  iconUrl: string | null;
  fallbackName: string;
  category: string;
  source?: '预设图标' | 'AI 生成' | '📷 上传';
}
```

Renders a centered modal when iconUrl !== null. Auto-handles backdrop fade-in.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/routes/IconLibrary.tsx` | The /icons route with list, new icon flow, row menu |
| `src/components/NewIconSheet.tsx` | Bottom sheet for "+ 新增" flow (name input → preset check → IconPickerPanel) |
| `src/components/IconPreviewOverlay.tsx` | Long-press preview popover for AddSheet |
| `src/hooks/useLongPress.ts` | Touch-safe long-press detection hook with movement tolerance |
| `src/utils/date-format.ts` | Relative date formatter ("3天前", "刚刚", "1周前") |

### Modified files

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/icons` route |
| `src/routes/List.tsx` | Replace header buttons (🎨 / 📤 / ⚙️), remove old MoreMenu trigger |
| `src/components/AddSheet.tsx` | Wire useLongPress + IconPreviewOverlay into icon buttons, add first-time hint toast |
| `src/components/MoreMenu.tsx` | Remove icon management entry (now in dedicated route) |

---

## Out of Scope

- Adding preview/long-press to ItemRow (list items) — only AddSheet for now
- Editing the name of a custom icon (no rename — only re-generate/delete)
- Bulk operations (multi-select delete) — single-row actions only
- Icon search within library — when there are many custom icons, can add later
- Long-press on Icon Library rows — just tap to preview for now
