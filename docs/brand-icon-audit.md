# Brand Icon Audit — MaiSha

**Date:** 2026-05-24
**Purpose:** Pre-App-Store-submission audit of all preset icons for potential brand imagery.
**Scope:** All `.webp` files in `public/icons/` cross-referenced with `src/utils/icon-registry.ts`.

> Icons are judged by filename and registry `name` only — actual image content was not inspected.
> Flag level is conservative: it is better to review a generic icon than to miss a branded one.

---

## Summary

| Flag Level | Count | Meaning |
|---|---|---|
| DEFINITE | 1 | Item name is a registered brand name |
| HIGH | 2 | Item is overwhelmingly identified with 1–2 dominant brands in China |
| MEDIUM | 3 | Item has prominent brand associations; depends on how icon was rendered |
| LOW | 2 | Generic concept but common brand shapes exist; review recommended |
| CLEAN | 52 | No brand concern identified |

**Total flagged for review: 8 icons**

---

## Flagged Icons

### DEFINITE — Must Replace

#### 1. `flavored-milk.webp` — 旺仔牛奶
- **Registry entry:** `{ name: '旺仔牛奶', icon: 'flavored-milk', category: '饮料' }`
- **Issue:** The item `name` is the Want Want (旺仔) brand name itself. Any watercolor rendering prompted with this name almost certainly depicts the red-and-white 旺仔 can with the child mascot face.
- **Action:** Replace with a generic flavored/kids' milk icon; rename registry entry to `儿童牛奶` or `调味牛奶`.

**Replacement prompt:**
```
A delicate watercolor illustration of a small round milk can for children, plain pastel colors,
no mascot, no logo, no text on the can. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

---

### HIGH — Very Likely Branded

#### 2. `cola.webp` — 可乐
- **Registry entry:** `{ name: '可乐', icon: 'cola', category: '饮料' }`
- **Issue:** "Cola" as a visual concept is almost universally rendered as a red Coca-Cola can or bottle. The red ribbon logo and can shape are protected trade dress.
- **Action:** Replace with a plain dark fizzy drink in a neutral-colored can or glass with ice.

**Replacement prompt:**
```
A delicate watercolor illustration of a generic dark fizzy soft drink in a plain silver or
neutral-colored can, no logo, no red ribbon, no distinctive branding. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

#### 3. `iced-tea.webp` — 冰红茶
- **Registry entry:** `{ name: '冰红茶', icon: 'iced-tea', category: '饮料' }`
- **Issue:** 冰红茶 (iced black tea) in China is strongly associated with Uni-President (统一) and Lipton (立顿) bottles/cans with distinctive label colors and shapes. A prompted image risks resembling their packaging.
- **Action:** Replace with a glass of iced tea with visible ice cubes, or a plain amber-liquid bottle without brand colors.

**Replacement prompt:**
```
A delicate watercolor illustration of a tall glass of iced black tea with ice cubes and a slice
of lemon, condensation on the glass. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

---

### MEDIUM — Depends on Rendering

#### 4. `peach-juice.webp` — 桃汁
- **Registry entry:** `{ name: '桃汁', icon: 'peach-juice', category: '饮料' }`
- **Issue:** In China, peach juice (桃汁) is heavily associated with Huiyuan (汇源) — a major brand with a distinctive yellow/orange carton. If the icon shows a carton, it may resemble Huiyuan packaging.
- **Action:** Review the image. If it shows a carton, replace with a glass of peach juice and a fresh peach.

**Replacement prompt:**
```
A delicate watercolor illustration of a glass of peach juice with a fresh peach resting beside it,
warm golden color, no packaging, no bottle, no carton. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

#### 5. `curry-block.webp` — 咖喱块
- **Registry entry:** `{ name: '咖喱块', icon: 'curry-block', category: '调料' }`
- **Issue:** Curry roux blocks (咖喱块) in China are dominated by S&B (爱思必) and House Foods, both with instantly recognizable yellow/red box-and-foil-block packaging. A rendered icon could closely resemble their trade dress.
- **Action:** Review the image. If it shows branded-looking packaging, replace with a loose curry block on a wooden board or in a bowl.

**Replacement prompt:**
```
A delicate watercolor illustration of two brown curry roux blocks on a small ceramic plate,
no box, no packaging, no wrapper. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

#### 6. `water.webp` — 矿泉水
- **Registry entry:** `{ name: '矿泉水', icon: 'water', category: '饮料' }`
- **Issue:** Mineral water bottle shapes in China are associated with Nongfu Spring (农夫山泉, red cap, mountain label) and C'estbon (怡宝). If the icon depicts a bottle with a distinctive profile or cap color, it may be brand-suggestive.
- **Action:** Review the image. If it shows a distinctive bottle, replace with a plain blue/clear water drop or a neutral bottle.

**Replacement prompt:**
```
A delicate watercolor illustration of a plain clear water bottle with a light blue cap and
pure water visible inside, no label design, no distinctive shape. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

---

### LOW — Generic Concept, Worth a Quick Look

#### 7. `soy-milk.webp` — 豆浆
- **Registry entry:** `{ name: '豆浆', icon: 'soy-milk', category: '饮料' }`
- **Issue:** Vitasoy (维他奶) and Yili (伊利) soy milk cartons have recognizable shapes/colors in this market. If rendered as a carton, it could look brand-specific.
- **Action:** If the icon shows a carton, consider replacing with a glass of soy milk and soybeans.

**Replacement prompt:**
```
A delicate watercolor illustration of a glass of warm creamy soy milk with a few whole soybeans
scattered beside it, no packaging. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

#### 8. `laundry-pods.webp` — 洗衣球
- **Registry entry:** `{ name: '洗衣球', icon: 'laundry-pods', category: '日用', aliases: ['洗衣液', '洗衣凝珠'] }`
- **Issue:** Tide Pods (汰渍) have a globally recognizable multi-color pod shape (blue/orange/white). If rendered as a colorful pod, it risks resembling Tide's protected trade dress.
- **Action:** If the icon shows a colorful multi-compartment pod, replace with a plain single-color pod or a neutral laundry capsule.

**Replacement prompt:**
```
A delicate watercolor illustration of a single plain light-blue laundry detergent pod or capsule,
simple oval shape, no multi-color compartments, no swirl pattern. On a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

---

## Clean Icons (No Brand Concern)

These 52 icons represent generic foods, spices, produce, or household items with no dominant single-brand visual identity:

`aged-vinegar`, `baby-cabbage`, `baking-soda`, `bay-leaves`, `beef-short-rib-strips`,
`beef-short-ribs`, `body-wash`, `bread-flour`, `cake-flour`, `chinkiang-vinegar`,
`chives`, `cinnamon-bark`, `cling-wrap`, `condensed-milk`, `conditioner`,
`cooking-oil`, `cooking-wine`, `daikon`, `dark-soy-sauce`, `dish-soap`,
`doubanjiang`, `eggs`, `five-spice`, `frozen-dumplings`, `garlic`,
`ginger`, `hand-soap`, `ketchup`, `kitchen-towel`, `light-soy-sauce`,
`milk`, `onion`, `oyster-sauce`, `pork-belly`, `pork-ribs`,
`rice`, `salt`, `scallion`, `shampoo`, `sichuan-pepper`,
`star-anise`, `sugar`, `thirteen-spice`, `tissue-box`, `toilet-paper`,
`tomato`, `toothbrush`, `toothpaste`, `trash-bags`, `water-bamboo`,
`white-vinegar`, `whole-chicken`

> Note: `milk` (牛奶) and `condensed-milk` (炼乳) are also common brand targets (Mengniu, Yili, Eagle Brand),
> but these categories have enough generic visual representations that a watercolor prompt is unlikely
> to produce brand-identifiable imagery without explicit brand cues.

---

## Next Steps

1. **DEFINITE (1 icon):** Replace immediately — `flavored-milk.webp`. Also update registry `name` from `旺仔牛奶` to a generic term.
2. **HIGH (2 icons):** Replace `cola.webp` and `iced-tea.webp` using prompts above before submission.
3. **MEDIUM (3 icons):** Visually inspect `peach-juice.webp`, `curry-block.webp`, `water.webp`. Replace if packaging-style.
4. **LOW (2 icons):** Visually inspect `soy-milk.webp` and `laundry-pods.webp`. Replace if brand-shaped.
