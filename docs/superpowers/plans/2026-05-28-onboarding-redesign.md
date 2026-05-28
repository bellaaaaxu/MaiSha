# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign MaiSha PWA onboarding to apply the existing journal aesthetic, fix 3 UI bugs reported on iPhone 16 Pro (safe-area, vertical layout, confirm button), and introduce wordmark + slogan as the app's visual signature.

**Architecture:** Pull all design tokens from existing `src/styles/theme.css` (already complete) and Google Fonts (already loaded in `index.html`). Introduce two new reusable components (`Wordmark`, `WashiTape`) in `src/components/`. Rewrite `src/routes/Onboarding.tsx` to use them, applying journal styling (paper texture, hand-drawn underlines, rotated cards). Fix `min-height` to use `calc(100dvh - safe-area-insets)` since body already has safe-area padding. Replace the conditional "确认" button with an always-visible "+" button.

**Tech Stack:** React 18, TypeScript, Vite, React Router 6, react-i18next, Vitest + React Testing Library, CSS variables, inline styles (matches existing pattern in `Onboarding.tsx`)

**Spec:** [docs/superpowers/specs/2026-05-28-onboarding-redesign-design.md](../specs/2026-05-28-onboarding-redesign-design.md)

---

## File Structure

**Create:**
- `src/components/Wordmark.tsx` — Brand wordmark, two variants (`hero` for Step 1, `mini` for Steps 2/3). Reads brand name + slogan from i18n.
- `src/components/WashiTape.tsx` — Decorative washi tape strip with configurable rotation, width, offset, blend mode.
- `src/components/__tests__/Wordmark.test.tsx` — Smoke test for both variants
- `src/components/__tests__/WashiTape.test.tsx` — Smoke test for the decorative img wrapper

**Modify:**
- `src/locales/zh-CN.json` — Add `slogan`, `wordmark`, `wordmarkLatin`, `addStoreHelper`, plus update `addStores`, `addStoresHint`, `currency`, `skip` text
- `src/locales/zh-TW.json` — Same keys, Cantonese style to match existing locale
- `src/locales/en.json` — Same keys, English
- `src/routes/Onboarding.tsx` — Complete rewrite with new design

**Already present (verify, no changes):**
- `public/decorations/washi-coral.png`
- `public/decorations/washi-blue.png`
- `public/decorations/washi-blue-botanical.png`
- `public/decorations/washi-sage-botanical.png`
- `src/styles/theme.css` — All `:root` variables (`--paper`, `--ink`, `--accent`, `--accent-soft`, `--green`, `--blue`, `--font-title`, `--font-body`, `--shadow-card`, etc.)
- `index.html` — Google Fonts already loaded (ZCOOL KuaiLe + Nunito + Noto Sans SC)

---

## Task 1: Add i18n keys for the redesigned onboarding

**Why first:** Foundational — every subsequent UI task references these strings. Doing this first lets later tasks fail with clear i18n errors instead of hardcoded text drift.

**Files:**
- Modify: `src/locales/zh-CN.json` (the `onboarding` section)
- Modify: `src/locales/zh-TW.json` (the `onboarding` section)
- Modify: `src/locales/en.json` (the `onboarding` section)

- [ ] **Step 1: Update `src/locales/zh-CN.json` onboarding section**

Replace the existing `"onboarding"` block (lines 68-77) with:

```json
  "onboarding": {
    "welcome": "欢迎使用买啥",
    "wordmark": "买啥",
    "wordmarkLatin": "MaiSha",
    "slogan": "去哪买，买点啥",
    "addStores": "常去的店",
    "addStoresHint": "你常去哪几家？后面可以随时改",
    "storePlaceholder": "输入店铺名称",
    "addStoreHelper": "按回车或点 + 添加，可以继续添加多个",
    "next": "下一步",
    "skip": "先这样，回头再加",
    "currency": "用什么货币",
    "done": "开始使用"
  },
```

- [ ] **Step 2: Update `src/locales/zh-TW.json` onboarding section (Cantonese style)**

Replace the existing `"onboarding"` block (lines 64-73) with:

```json
  "onboarding": {
    "welcome": "歡迎使用買咩",
    "wordmark": "買咩",
    "wordmarkLatin": "MaiSha",
    "slogan": "去邊買，買啲咩",
    "addStores": "成日去嘅舖頭",
    "addStoresHint": "你成日去邊幾間？之後可以隨時改",
    "storePlaceholder": "輸入舖頭名",
    "addStoreHelper": "撳 Enter 或者點 + 加，可以加多幾間",
    "next": "下一步",
    "skip": "先咁啦，遲啲再加",
    "currency": "用咩貨幣",
    "done": "開始用"
  },
```

- [ ] **Step 3: Update `src/locales/en.json` onboarding section**

Replace the existing `"onboarding"` block (lines 68-77) with:

```json
  "onboarding": {
    "welcome": "Welcome to MaiSha",
    "wordmark": "MaiSha",
    "wordmarkLatin": "买啥",
    "slogan": "Where to go, what to get",
    "addStores": "Where you shop",
    "addStoresHint": "Pick a few stores you visit often — you can change this anytime",
    "storePlaceholder": "Store name",
    "addStoreHelper": "Press Enter or tap + to add. You can add as many as you like.",
    "next": "Next",
    "skip": "Maybe later",
    "currency": "What currency",
    "done": "Get started"
  },
```

- [ ] **Step 4: Verify the JSON files are valid**

Run:
```
npm run typecheck
```
Expected: No errors. If a locale file has invalid JSON, TypeScript / Vite picks it up at import time.

- [ ] **Step 5: Commit**

```
git add src/locales/zh-CN.json src/locales/zh-TW.json src/locales/en.json
git commit -m "feat(i18n): add onboarding redesign strings (wordmark, slogan, helper)"
```

---

## Task 2: Create the Wordmark component

**Files:**
- Create: `src/components/Wordmark.tsx`
- Create: `src/components/__tests__/Wordmark.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/Wordmark.test.tsx` with:

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import Wordmark from '../Wordmark';

beforeAll(async () => {
  // Force zh-CN so assertions against Chinese strings are deterministic
  // (LanguageDetector can otherwise pick navigator language in jsdom).
  await i18n.changeLanguage('zh-CN');
});

describe('Wordmark', () => {
  it('renders the brand name and Latin subtitle in hero variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="hero" />
      </I18nextProvider>
    );
    expect(screen.getByText('买啥')).toBeInTheDocument();
    expect(screen.getByText('MaiSha')).toBeInTheDocument();
  });

  it('renders the slogan in hero variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="hero" />
      </I18nextProvider>
    );
    expect(screen.getByText('去哪买，买点啥')).toBeInTheDocument();
  });

  it('does not render the slogan in mini variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="mini" />
      </I18nextProvider>
    );
    expect(screen.queryByText('去哪买，买点啥')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm test -- src/components/__tests__/Wordmark.test.tsx
```
Expected: FAIL with "Cannot find module '../Wordmark'"

- [ ] **Step 3: Create the Wordmark component**

Create `src/components/Wordmark.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

type Variant = 'hero' | 'mini';

interface WordmarkProps {
  variant: Variant;
}

export default function Wordmark({ variant }: WordmarkProps) {
  const { t } = useTranslation();
  const isHero = variant === 'hero';

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: isHero ? 56 : 28,
          color: 'var(--ink)',
          letterSpacing: isHero ? 8 : 4,
          lineHeight: 1.1,
          position: 'relative',
          display: 'inline-block',
        }}
      >
        {t('onboarding.wordmark')}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: isHero ? -6 : -3,
            height: isHero ? 3 : 2,
            background: 'var(--accent-soft)',
            borderRadius: 2,
            transform: isHero ? 'rotate(-0.5deg)' : 'rotate(-0.3deg)',
            opacity: 0.7,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-en)',
          fontSize: isHero ? 14 : 10,
          color: isHero ? 'var(--ink-light)' : 'var(--ink-faint)',
          letterSpacing: isHero ? 3 : 2,
          marginTop: isHero ? 10 : 6,
          fontWeight: 600,
        }}
      >
        {t('onboarding.wordmarkLatin')}
      </div>
      {isHero && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            color: 'var(--ink-light)',
            marginTop: 24,
          }}
        >
          {t('onboarding.slogan')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm test -- src/components/__tests__/Wordmark.test.tsx
```
Expected: PASS (all 3 tests)

- [ ] **Step 5: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 6: Commit**

```
git add src/components/Wordmark.tsx src/components/__tests__/Wordmark.test.tsx
git commit -m "feat(components): add Wordmark with hero/mini variants"
```

---

## Task 3: Create the WashiTape component

**Files:**
- Create: `src/components/WashiTape.tsx`
- Create: `src/components/__tests__/WashiTape.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/WashiTape.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WashiTape from '../WashiTape';

describe('WashiTape', () => {
  it('renders an img with the given src and empty alt', () => {
    render(<WashiTape src="/decorations/washi-coral.png" />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/decorations/washi-coral.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('applies rotation and width via inline style', () => {
    render(<WashiTape src="/decorations/washi-coral.png" rotation={-5} width={120} />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.style.transform).toContain('rotate(-5deg)');
    expect(img.style.width).toBe('120px');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm test -- src/components/__tests__/WashiTape.test.tsx
```
Expected: FAIL with "Cannot find module '../WashiTape'"

- [ ] **Step 3: Create the WashiTape component**

Create `src/components/WashiTape.tsx`:

```tsx
import type { CSSProperties } from 'react';

interface WashiTapeProps {
  src: string;
  rotation?: number;       // degrees, default -3
  width?: number;          // px, default 100
  offsetX?: number;        // px, default 0
  offsetY?: number;        // px, default 0
  opacity?: number;        // default 0.85
  blendMultiply?: boolean; // default false; set true to blend into paper
  style?: CSSProperties;
}

export default function WashiTape({
  src,
  rotation = -3,
  width = 100,
  offsetX = 0,
  offsetY = 0,
  opacity = 0.85,
  blendMultiply = false,
  style,
}: WashiTapeProps) {
  return (
    <img
      role="presentation"
      alt=""
      src={src}
      style={{
        width,
        height: 'auto',
        transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
        opacity,
        mixBlendMode: blendMultiply ? 'multiply' : 'normal',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style,
      }}
      draggable={false}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm test -- src/components/__tests__/WashiTape.test.tsx
```
Expected: PASS (both tests)

- [ ] **Step 5: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 6: Commit**

```
git add src/components/WashiTape.tsx src/components/__tests__/WashiTape.test.tsx
git commit -m "feat(components): add WashiTape decoration component"
```

---

## Task 4: Rewrite Onboarding.tsx — container layout, step indicator, bottom buttons

**Why this task scope:** Replacing the outer shell first (container, step dots, bottom button) lets later tasks focus on each step's content. The 3 UI bugs (safe-area, flex-start, bottom padding) all live in this outer shell.

**Files:**
- Modify: `src/routes/Onboarding.tsx` (full rewrite)

**Important:** This task only replaces the **outer structure** — the contents of each step are temporarily kept as the old version (with emoji + old buttons). Tasks 5/6/7 will replace each step's contents.

- [ ] **Step 1: Read the current Onboarding.tsx to confirm state**

Run:
```
npm run dev
```
Open `http://localhost:5173/onboarding` to confirm current behavior. (Note: if `maisha:seen` is already set, clear it via DevTools → Application → Local Storage to see onboarding again.)

- [ ] **Step 2: Replace Onboarding.tsx with the new outer shell**

Overwrite `src/routes/Onboarding.tsx` with:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { saveCurrency, getAllCurrencies, getOrDetectCurrency } from '@/utils/currency';
import Wordmark from '@/components/Wordmark';
import WashiTape from '@/components/WashiTape';
import type { Store } from '@/types/store';

const POPULAR_CURRENCIES = ['CNY', 'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'HKD', 'TWD', 'SGD'];
const TOTAL_STEPS = 3;

const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"), linear-gradient(180deg, var(--paper) 0%, #F7F0E6 100%)`;

export default function Onboarding() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language || 'zh-CN');
  const [addedStores, setAddedStores] = useState<Store[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const detectedCurrency = getOrDetectCurrency();
  const [currencyCode, setCurrencyCode] = useState(detectedCurrency.code);

  const goNext = () => {
    if (step >= TOTAL_STEPS - 1) return finish();
    setStep(s => s + 1);
  };

  const goBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  const addStore = () => {
    const name = newStoreName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    setAddedStores(prev => [...prev, { id, name }]);
    setNewStoreName('');
  };

  const removeStore = (index: number) => {
    setAddedStores(prev => prev.filter((_, i) => i !== index));
  };

  const finish = () => {
    saveCurrency(currencyCode);
    const stores: Store[] = [
      ...addedStores,
      { id: 'none', name: t('addSheet.noStore') },
    ];
    localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(stores));
    localStorage.setItem('maisha:language', language);
    localStorage.setItem('maisha:seen', '1');
    nav('/list');
  };

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        background: 'var(--paper)',
        backgroundImage: PAPER_TEXTURE,
      }}
    >
      {/* Back button */}
      {step > 0 && (
        <button
          onClick={goBack}
          style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--ink-light)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 8,
            padding: 0,
          }}
        >
          ← {t('shopping.back')}
        </button>
      )}

      {/* Step indicator: dashed-line journal style */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          marginBottom: 32,
          marginTop: step === 0 ? 8 : 0,
        }}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 32 : 16,
              height: 3,
              background: i <= step ? 'var(--accent-soft)' : 'var(--ink-faint)',
              borderRadius: 2,
              opacity: i <= step ? 0.8 : 0.3,
              transform: i === step ? 'rotate(-0.3deg)' : 'none',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {/* Step content area — top-aligned, not centered */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          maxWidth: 360,
          margin: '0 auto',
          width: '100%',
          paddingTop: 8,
        }}
      >
        {step === 0 && <Step0Language language={language} setLanguage={setLanguage} />}
        {step === 1 && (
          <Step1Stores
            addedStores={addedStores}
            newStoreName={newStoreName}
            setNewStoreName={setNewStoreName}
            addStore={addStore}
            removeStore={removeStore}
          />
        )}
        {step === 2 && <Step2Currency currencyCode={currencyCode} setCurrencyCode={setCurrencyCode} />}
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          maxWidth: 360,
          margin: '0 auto',
          width: '100%',
          paddingTop: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <button
          onClick={goNext}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            color: 'white',
            background: 'var(--green)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(123, 163, 126, 0.25)',
          }}
        >
          {step === TOTAL_STEPS - 1 ? t('onboarding.done') : t('onboarding.next')}
        </button>
        {step === 1 && (
          <button
            onClick={finish}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ink-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            {t('onboarding.skip')}
          </button>
        )}
      </div>
    </div>
  );
}

// Placeholder step components — replaced in Tasks 5/6/7
function Step0Language({ language, setLanguage }: { language: string; setLanguage: (l: string) => void }) {
  const { i18n } = useTranslation();
  return (
    <div>
      <Wordmark variant="hero" />
      <div style={{ marginTop: 40 }}>
        {[
          { code: 'zh-CN', label: '简体中文' },
          { code: 'zh-TW', label: '繁體中文' },
          { code: 'en', label: 'English' },
        ].map(lang => (
          <button
            key={lang.code}
            onClick={() => {
              i18n.changeLanguage(lang.code);
              setLanguage(lang.code);
            }}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              padding: '14px 20px',
              marginBottom: 12,
              borderRadius: 14,
              border: 'none',
              background: 'white',
              color: 'var(--ink)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow:
                language === lang.code
                  ? 'inset 4px 0 0 0 var(--accent), 0 2px 8px rgba(74, 55, 40, 0.06)'
                  : '0 2px 8px rgba(74, 55, 40, 0.06)',
            }}
          >
            <span>{lang.label}</span>
            {language === lang.code && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step1Stores(_props: {
  addedStores: Store[];
  newStoreName: string;
  setNewStoreName: (s: string) => void;
  addStore: () => void;
  removeStore: (i: number) => void;
}) {
  return <div>Step 1 placeholder — replaced in Task 6</div>;
}

function Step2Currency(_props: { currencyCode: string; setCurrencyCode: (c: string) => void }) {
  return <div>Step 2 placeholder — replaced in Task 7</div>;
}
```

- [ ] **Step 3: Run type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 4: Run tests**

Run:
```
npm test
```
Expected: All existing tests pass; Wordmark and WashiTape tests pass.

- [ ] **Step 5: Run the dev server and verify the outer shell renders**

Run:
```
npm run dev
```

Then:
1. Open browser DevTools → Application → Local Storage → delete `maisha:seen`
2. Navigate to `http://localhost:5173/onboarding`
3. Verify:
   - Paper background with subtle noise texture is visible
   - Hero wordmark "买啥 / MaiSha / 去哪买，买点啥" renders centered at the top
   - 3 dashed step indicators above wordmark, first one wider/coral
   - Language selection buttons render below wordmark
   - "下一步" button at the bottom, ABOVE the home indicator area (test by inspecting on iPhone DevTools view, e.g., iPhone 14 Pro at 393×852)
4. Click "下一步" → Step 1 placeholder text appears
5. Click "下一步" again → Step 2 placeholder text appears

- [ ] **Step 6: Commit**

```
git add src/routes/Onboarding.tsx
git commit -m "feat(onboarding): rewrite shell with journal styling and safe-area fix"
```

---

## Task 5: Build Step 1 (language) with Hero wordmark and washi tape decoration

**Note:** Step 0 already has the Hero wordmark from Task 4. This task adds the sage-botanical washi tape decoration above it.

**Files:**
- Modify: `src/routes/Onboarding.tsx` (the `Step0Language` component)

- [ ] **Step 1: Add washi tape above the Wordmark in Step0Language**

Modify `Step0Language` in `src/routes/Onboarding.tsx`. Replace the function body with:

```tsx
function Step0Language({ language, setLanguage }: { language: string; setLanguage: (l: string) => void }) {
  const { i18n } = useTranslation();
  return (
    <div>
      {/* Washi tape decoration above wordmark */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <WashiTape
          src="/decorations/washi-sage-botanical.png"
          width={120}
          rotation={-3}
          opacity={0.85}
          style={{ marginLeft: -40 }}
        />
      </div>
      <Wordmark variant="hero" />
      <div style={{ marginTop: 40 }}>
        {[
          { code: 'zh-CN', label: '简体中文' },
          { code: 'zh-TW', label: '繁體中文' },
          { code: 'en', label: 'English' },
        ].map(lang => (
          <button
            key={lang.code}
            onClick={() => {
              i18n.changeLanguage(lang.code);
              setLanguage(lang.code);
            }}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              padding: '14px 20px',
              marginBottom: 12,
              borderRadius: 14,
              border: 'none',
              background: 'white',
              color: 'var(--ink)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow:
                language === lang.code
                  ? 'inset 4px 0 0 0 var(--accent), 0 2px 8px rgba(74, 55, 40, 0.06)'
                  : '0 2px 8px rgba(74, 55, 40, 0.06)',
            }}
          >
            <span>{lang.label}</span>
            {language === lang.code && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 3: Visual verification**

Run:
```
npm run dev
```
1. Clear `maisha:seen` from local storage
2. Open `/onboarding`
3. Verify:
   - Sage-green botanical washi tape appears slightly left of the wordmark, rotated counterclockwise
   - Wordmark is below the tape, centered
   - Three language buttons below; clicking one highlights it with a coral left-edge inset

- [ ] **Step 4: Commit**

```
git add src/routes/Onboarding.tsx
git commit -m "feat(onboarding): add washi tape decoration to language step"
```

---

## Task 6: Build Step 2 (stores) with mini wordmark, washi tape, restyled chips, fixed + button

**Why this is its own task:** This step contains the most behavior — chips with rotation/border, input with always-visible "+" button, helper text. All Bug 3's fixes live here.

**Files:**
- Modify: `src/routes/Onboarding.tsx` (the `Step1Stores` component)

- [ ] **Step 1: Replace the Step1Stores component**

In `src/routes/Onboarding.tsx`, replace the `Step1Stores` function body with:

```tsx
function Step1Stores({
  addedStores,
  newStoreName,
  setNewStoreName,
  addStore,
  removeStore,
}: {
  addedStores: Store[];
  newStoreName: string;
  setNewStoreName: (s: string) => void;
  addStore: () => void;
  removeStore: (i: number) => void;
}) {
  const { t } = useTranslation();
  const hasInput = newStoreName.trim().length > 0;

  // Rotation and border color cycle per chip index
  const chipRotations = [-0.3, 0.2, -0.15, 0.25, -0.2];
  const chipBorderColors = ['var(--accent-soft)', 'var(--green-soft)', 'var(--blue)'];

  return (
    <div>
      <Wordmark variant="mini" />

      {/* Step title area: washi tape + title + underline */}
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <WashiTape
            src="/decorations/washi-coral.png"
            width={100}
            rotation={-3}
            opacity={0.85}
            style={{ marginRight: -40 }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--ink)',
            letterSpacing: 2,
            display: 'inline-block',
            position: 'relative',
            margin: 0,
          }}
        >
          {t('onboarding.addStores')}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -4,
              height: 3,
              background: 'var(--accent-soft)',
              borderRadius: 2,
              transform: 'rotate(-0.5deg)',
              opacity: 0.7,
            }}
          />
        </h2>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--ink-light)',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        {t('onboarding.addStoresHint')}
      </p>

      {/* Added stores list */}
      {addedStores.map((store, i) => (
        <div
          key={`${store.id}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            padding: '14px 16px',
            background: 'white',
            borderRadius: 14,
            boxShadow: 'var(--shadow-card)',
            borderLeft: `4px solid ${chipBorderColors[i % chipBorderColors.length]}`,
            transform: `rotate(${chipRotations[i % chipRotations.length]}deg)`,
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--font-title)',
              fontSize: 18,
              letterSpacing: 1,
              color: 'var(--ink)',
            }}
          >
            {store.name}
          </span>
          <button
            onClick={() => removeStore(i)}
            aria-label="Remove store"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--ink-faint)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Input area: text input + always-visible + button */}
      <div style={{ display: 'flex', gap: 8, marginTop: addedStores.length > 0 ? 16 : 0 }}>
        <input
          value={newStoreName}
          onChange={e => setNewStoreName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') addStore();
          }}
          placeholder={t('onboarding.storePlaceholder')}
          style={{
            flex: 1,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            padding: '12px 16px',
            borderRadius: 14,
            border: '1px dashed var(--ink-faint)',
            background: 'white',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button
          onClick={addStore}
          disabled={!hasInput}
          aria-label="Add store"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: hasInput ? 'var(--accent)' : 'var(--ink-faint)',
            opacity: hasInput ? 1 : 0.4,
            color: 'white',
            fontSize: 24,
            fontWeight: 300,
            cursor: hasInput ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, opacity 0.2s',
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--ink-faint)',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        {t('onboarding.addStoreHelper')}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 3: Visual verification**

Run:
```
npm run dev
```
1. Clear `maisha:seen` and navigate to onboarding
2. Click through to Step 2 (stores)
3. Verify:
   - Mini wordmark "买啥 / MaiSha" at top (smaller than Step 1)
   - Coral washi tape above the title "常去的店"
   - Title with hand-drawn coral underline
   - Hint text "你常去哪几家？后面可以随时改" below title
   - Input field with dashed border, "+" button to the right
   - "+" button is GRAY and DISABLED when input is empty
4. Type "宜家" in the input → "+" button turns CORAL
5. Click "+" → chip appears with slight rotation and coral left border, input clears
6. Add 2 more stores → chips show different border colors (green, blue) and alternate rotations
7. Type something else → helper text "按回车或点 + 添加，可以继续添加多个" visible below input
8. Click × on a chip → it removes

- [ ] **Step 4: Commit**

```
git add src/routes/Onboarding.tsx
git commit -m "feat(onboarding): rebuild stores step with chips, fixed + button, helper text"
```

---

## Task 7: Build Step 3 (currency) with mini wordmark and blue washi

**Files:**
- Modify: `src/routes/Onboarding.tsx` (the `Step2Currency` component)

- [ ] **Step 1: Replace the Step2Currency component**

In `src/routes/Onboarding.tsx`, replace the `Step2Currency` function body with:

```tsx
function Step2Currency({
  currencyCode,
  setCurrencyCode,
}: {
  currencyCode: string;
  setCurrencyCode: (c: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Wordmark variant="mini" />

      <div style={{ position: 'relative', textAlign: 'center', marginTop: 32, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <WashiTape
            src="/decorations/washi-blue.png"
            width={100}
            rotation={-3}
            opacity={0.85}
            style={{ marginLeft: -40 }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--ink)',
            letterSpacing: 2,
            display: 'inline-block',
            position: 'relative',
            margin: 0,
          }}
        >
          {t('onboarding.currency')}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -4,
              height: 3,
              background: 'var(--accent-soft)',
              borderRadius: 2,
              transform: 'rotate(-0.5deg)',
              opacity: 0.7,
            }}
          />
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginTop: 24,
        }}
      >
        {getAllCurrencies()
          .filter(c => POPULAR_CURRENCIES.includes(c.code))
          .map(c => (
            <button
              key={c.code}
              onClick={() => setCurrencyCode(c.code)}
              style={{
                fontFamily: 'var(--font-body)',
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: 'white',
                color: 'var(--ink)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow:
                  currencyCode === c.code
                    ? 'inset 4px 0 0 0 var(--blue), 0 2px 8px rgba(74, 55, 40, 0.06)'
                    : '0 2px 8px rgba(74, 55, 40, 0.06)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: 18, fontWeight: 400 }}>
                  {c.symbol}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--font-en)', letterSpacing: 1 }}>
                  {c.code}
                </div>
              </div>
              {currencyCode === c.code && (
                <span style={{ color: 'var(--blue)', fontWeight: 700 }}>✓</span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 3: Visual verification**

Run:
```
npm run dev
```
1. Navigate through onboarding to Step 3
2. Verify:
   - Mini wordmark at top
   - Blue washi tape above the title "用什么货币"
   - 10-currency grid (2 columns)
   - Currently-detected currency is highlighted with blue inset left border
3. Click another currency → selection moves to the clicked one

- [ ] **Step 4: Commit**

```
git add src/routes/Onboarding.tsx
git commit -m "feat(onboarding): rebuild currency step with mini wordmark and blue washi"
```

---

## Task 8: Add finish fade-in animation with blue-botanical washi

**Files:**
- Modify: `src/routes/Onboarding.tsx` (add a finish-celebration state)

- [ ] **Step 1: Add finishing state and animation to Onboarding**

In `src/routes/Onboarding.tsx`, modify the `Onboarding` component to add a finishing state and fade-in render.

Find the `const [currencyCode, setCurrencyCode] = useState(detectedCurrency.code);` line and add below it:

```tsx
  const [finishing, setFinishing] = useState(false);
```

Replace the `finish` function with:

```tsx
  const finish = () => {
    setFinishing(true);
    saveCurrency(currencyCode);
    const stores: Store[] = [
      ...addedStores,
      { id: 'none', name: t('addSheet.noStore') },
    ];
    localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(stores));
    localStorage.setItem('maisha:language', language);
    localStorage.setItem('maisha:seen', '1');
    setTimeout(() => nav('/list'), 600);
  };
```

Just before the closing `</div>` of the outermost container, insert the finishing overlay:

```tsx
      {finishing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(251, 246, 239, 0.92)',
            zIndex: 100,
            animation: 'inkSpread 0.5s ease-out',
          }}
        >
          <WashiTape
            src="/decorations/washi-blue-botanical.png"
            width={240}
            rotation={-3}
            opacity={0.95}
          />
        </div>
      )}
```

(Note: `inkSpread` keyframe is already defined in `src/index.css:65-69`.)

- [ ] **Step 2: Type check**

Run:
```
npm run typecheck
```
Expected: No errors

- [ ] **Step 3: Visual verification**

Run:
```
npm run dev
```
1. Complete onboarding through Step 3
2. Click "开始使用"
3. Verify:
   - Blue-botanical washi tape fades in over a paper-cream overlay
   - About 600ms later, navigates to `/list`

- [ ] **Step 4: Commit**

```
git add src/routes/Onboarding.tsx
git commit -m "feat(onboarding): add finish fade-in with botanical washi celebration"
```

---

## Task 9: End-to-end manual verification + iPhone 16 Pro spot check

**Files:** None modified.

**Purpose:** Walk through the entire onboarding flow on multiple viewports and confirm all spec requirements are met. Document any visible issues for follow-up.

- [ ] **Step 1: Build production bundle**

Run:
```
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run full test suite**

Run:
```
npm test
```
Expected: All tests pass.

- [ ] **Step 3: Walk through on desktop + iPhone DevTools**

Start dev server: `npm run dev`

In the browser:
1. Open DevTools → Application → Local Storage → delete `maisha:seen`
2. Toggle device toolbar → choose "iPhone 14 Pro" or larger (393×852)
3. Open `http://localhost:5173/onboarding`

Verify all of:

**Layout / Bugs:**
- [ ] Step indicator (3 dashes) sits below the Dynamic Island notch area
- [ ] Hero wordmark on Step 1 is visible at the top, not floating mid-screen
- [ ] "下一步" button is fully visible and above the home indicator area on all 3 steps
- [ ] No vertical scroll on any step (unless content overflows naturally — e.g., 5+ added stores)

**Step 1 (Language):**
- [ ] Sage-green botanical washi visible at top, slightly left of wordmark
- [ ] Wordmark: "买啥" (56px) + "MaiSha" (small caps) + coral underline + slogan below
- [ ] 3 language buttons; clicking switches the wordmark + slogan + button labels to that language
- [ ] Selected button shows coral left inset

**Step 2 (Stores):**
- [ ] Mini wordmark at top
- [ ] Coral washi above title
- [ ] Title "常去的店" with coral underline
- [ ] Input field with dashed border
- [ ] "+" button always visible, gray-disabled when empty, coral when input has text
- [ ] Adding a store: chip appears with rotation + colored left border (cycles coral → green → blue)
- [ ] Helper text "按回车或点 + 添加..." visible
- [ ] Skip button "先这样，回头再加" visible below main button

**Step 3 (Currency):**
- [ ] Mini wordmark at top
- [ ] Blue washi above title "用什么货币"
- [ ] 2-column grid of 10 currencies
- [ ] Selected currency has blue left inset

**Finish:**
- [ ] Clicking "开始使用" shows blue-botanical washi fading in
- [ ] Navigates to `/list` after ~600ms

**Multi-language:**
- [ ] Switch to English on Step 1 → wordmark becomes "MaiSha / 买啥", slogan becomes "Where to go, what to get"
- [ ] Switch to 繁體中文 (Cantonese) → wordmark becomes "買咩 / MaiSha", slogan becomes "去邊買，買啲咩"

- [ ] **Step 4: If any issues found, fix them before continuing**

For each issue:
1. Identify the file & line
2. Make a targeted fix
3. Re-verify the specific affected behavior
4. Commit with a clear message

- [ ] **Step 5: Final commit (if any fixes from Step 4)**

If no fixes needed, no commit. If fixes made:
```
git commit -m "fix(onboarding): <specific issue>"
```

- [ ] **Step 6: Tag the design and plan as complete**

This is a documentation-only commit to associate this implementation with the spec:

```
git commit --allow-empty -m "docs: onboarding redesign implementation complete (see specs/2026-05-28-onboarding-redesign-design.md)"
```

---

## Out-of-Scope (do not implement)

The following are deliberately deferred. If you notice them while implementing, do **not** address them in this plan:

- **Data persistence recovery** — anonymous Supabase session fragility. See [memory/project_data_persistence_risk.md](C:\Users\user\.claude\projects\C--Users-user-Desktop-MaiSha\memory\project_data_persistence_risk.md)
- **Collectibles / stamps / cats** — separate brainstorm. See [memory/project_collectibles_idea.md](C:\Users\user\.claude\projects\C--Users-user-Desktop-MaiSha\memory\project_collectibles_idea.md)
- **App icon redesign** — current `public/icon.svg` is WeChat-green and generic; not changed here
- **Step transition animations** — page-flip / slide effects are deferred to v2
- **Haptic feedback** — Capacitor `Haptics` plugin integration deferred

If something blocks implementation that is genuinely in this plan's scope, stop and report rather than expanding scope.
