# MaiSha Repositioning: From Grocery List to Daily Shopping Companion

**Date:** 2026-05-25
**Status:** Approved

## Core Positioning

**Problem:** "I'm going to this store — what was I supposed to buy?"

**Solution:** A per-store shopping memo that remembers what you need at each store. Never forget, never duplicate, never waste a trip.

**Tagline direction:** Record what to buy at every store. Don't forget, don't repeat, don't waste a trip.

## Target Users

- Global users: Simplified Chinese, Traditional Chinese (Cantonese-leaning), English
- Primary: individuals managing daily shopping across multiple stores
- Secondary: families/roommates collaborating on shared lists
- Model: personal-first, sharing as a bonus (not a prerequisite)

## Scope of Changes

### 1. Terminology Rename

| Before | After |
|--------|-------|
| `Supermarket` interface | `Store` interface |
| `supermarket.ts` | `store.ts` |
| `SupermarketCard` | `StoreCard` |
| `ManageMarkets` | `ManageStores` |
| `DEFAULT_SUPERMARKETS` | `DEFAULT_STORES` |
| All variable names `supermarket(s)` | `store(s)` |

**Store interface (simplified):**
```typescript
interface Store {
  id: string;
  name: string;  // text only, no emoji, no icon
}
```

**Database columns** (`items.supermarket`, `lists.supermarkets` JSONB): keep unchanged to avoid migration risk. Map at the type layer.

**UI copy:**
- "supermarket" / "store" — "store" in English, "shop" in Chinese contexts
- "Unclassified" — "No store assigned" / "Not assigned to store"
- "Manage supermarkets" — "Manage stores"

### 2. Default Stores & Onboarding

**No default stores.** New users add 1-2 store names themselves during onboarding. A "skip" option is available (falls back to a single "unassigned" store).

**Onboarding flow:**
1. Language selection (defaults to system language)
2. Add 1-2 stores you frequently visit (free text input)
3. Currency selection

Removed: household size step (not relevant for personal-first positioning).

### 3. Remove Category System

**Current:** 11 food categories (vegetables, fruits, meat, dairy...) with keyword auto-matching, items grouped by category within each store.

**New:** No category grouping. Items displayed as a flat visual grid within each store card. Each store typically has 3-8 items — sub-grouping adds complexity without value.

**Remove:**
- `CategoryKey` type and `CATEGORY_DEFS` constants
- `category-matcher.ts` keyword matching logic
- Category grouping in `group-items.ts`
- `items.category` and `items.category_emoji` fields (deprecate, stop writing)

**Keep:** Item `note` field for user-provided context ("organic", "for the study", etc.)

### 4. Page Structure & Navigation

#### Main Page Header
```
Header :  Buy What (买啥)          [Join (一起买)]  [⚙]
Tab bar:  [List (清单)]  [History (历史)]
```

- "Join" / "一起买": share list link for collaboration. Text button, not icon.
- ⚙: opens settings drawer (left slide-in)
- "List" / "History": top-level tab switching

#### List View (清单 tab)
- Per-store cards with layered shadow for depth
- Items displayed as **icon grid** (image + name + note), no checkboxes
- Tapping an item opens edit/delete options
- "Go Shopping →" button per store card
- "+ Add Item" dashed area at bottom

#### Shopping Mode (去购物)
- Full-screen immersive view for one store
- Header: ← Back + Store name
- Progress bar: "Bought X / Y items"
- Items as **image + text list** (larger tap targets for in-store use)
- Tap to mark as bought → item fades (opacity 0.45) with green ✓ badge
- **Bought items auto-sink** to bottom of list, unbought stay on top
- **Smart ordering:** learn user's purchase order per store over time (record timestamp order at shopping completion, average across sessions, pre-sort next visit)
- "+ Add one more" for impulse additions
- "Finish Shopping" button → saves to history

#### Settings Drawer (⚙)
Pure text menu, left slide-in:
- Language settings
- Icon library
- Import / Export
- Personal presets (manage stores)
- Privacy & Terms
- Contact Us

### 5. Visual Design: Journal Style

**Overall direction:** Handwritten journal / notebook aesthetic — "flipping open my shopping notebook."

**Typography:**
- Titles & store names: ZCOOL KuaiLe (站酷快乐体) — round, warm, distinctive
- Body text: Noto Sans SC — clean, round sans-serif
- English: Nunito — round to match Chinese style
- Note: Chinese font subsetting needed to control bundle size

**Colors:**
- Paper background: `#FBF6EF` (warm off-white with subtle texture)
- Ink: `#4A3728` (warm brown, not black)
- Accent: `#D4836B` (warm coral)
- Green: `#7BA37E` (muted sage for "bought" states)
- Card borders: soft colored left borders (coral, green, blue) for visual categorization between stores

**Store cards:**
- White background, 14px border-radius
- Triple-layered box shadow for floating depth
- Subtle colored left border per card
- Semi-transparent "tape" decoration (optional)

**Checked/bought items:**
- Style C: opacity fade only (0.45), no strikethrough
- Green ✓ badge in shopping mode
- Text remains fully readable

**Decorative elements:**
- Dashed dividers (hand-drawn feel)
- Subtle watercolor splash gradients in background
- Paper texture overlay on main background

### 6. Multi-language (i18n)

**Framework:** `i18next` + `react-i18next`

**File structure:**
```
src/locales/
  zh-CN.json   (Simplified Chinese)
  zh-TW.json   (Traditional Chinese, Cantonese-leaning)
  en.json      (English)
```

**Language detection:** Default to system language. Manual override in settings.

**What to translate:**
- All UI copy (buttons, titles, prompts, empty states, toasts)
- Onboarding flow
- Settings page
- App Store metadata (title, subtitle, description, keywords)

**What NOT to translate:**
- User-entered store names and item names
- AI icon generation prompts (adapt to user's input language)

**Copy style:**
- zh-CN: casual, warm (current style)
- zh-TW: Cantonese usage conventions
- en: casual, warm, matching app's personality

### 7. Smart Shopping Order (New Feature)

**Per-store purchase order learning:**
1. Each time user finishes shopping, record the order items were checked off (timestamp per item)
2. Store this order history per store (in `purchase_history` or a new lightweight table)
3. After 2-3 sessions at the same store, compute average item-type ordering
4. On next shopping mode entry, pre-sort items by learned order
5. Fallback: insertion order if no history exists

**Implementation priority:** v2 — ship without it first, add after core repositioning is complete.

## Out of Scope (Not Now)

- Non-food category auto-classification (wait for user feedback)
- Store template recommendations
- Region-specific store presets
- Complex i18n locale adaptation beyond the three languages
- Android version

## Migration Notes

- Existing users' data (supermarket names, items) remains valid — renaming is cosmetic
- Database columns unchanged, only type-layer mapping
- Category fields on existing items become unused but don't need deletion
- Onboarding re-triggers only for new users
