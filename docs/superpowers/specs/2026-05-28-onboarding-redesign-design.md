# Onboarding 重新设计

**日期：** 2026-05-28
**范围：** 重做 MaiSha PWA 的 onboarding 流程视觉与交互
**目标：** 让用户第一次打开 app 时，立刻感受到「精致、温暖、整洁」的手账气质，并修复 3 个具体的 UI bug

---

## 1. 背景

MaiSha 的 onboarding 当前由 [src/routes/Onboarding.tsx](src/routes/Onboarding.tsx) 实现，共 3 步：语言选择 → 添加店铺 → 货币选择。但它与 app 其他部分的视觉语言完全脱节：

- 使用系统 emoji（🌏 🏪 💰）作为装饰，没有品牌识别
- 白底 + 灰色边框的通用按钮样式，跟 app 主界面的「水彩纸张」感不连贯
- App 已经在 [public/mockup-journal.html](public/mockup-journal.html) 里定义了一整套「手账风」视觉系统，但 onboarding 完全没采用

同时用户在 iPhone 16 Pro PWA 上反馈 3 个具体可用性问题（详见 §3）。

App Store 上架在即，onboarding 是用户对 app 的**第一印象决定窗口**——这次重做的核心赌注是：把现有的 journal 视觉语言搬到 onboarding，让用户进入 app 的第一画面就成为 app 视觉调性的**最强展示**，而不是最弱。

**本次不处理（已与用户对齐，单独追踪）：**

- 数据持久化丢失风险（见 [memory/project_data_persistence_risk.md](C:\Users\user\.claude\projects\C--Users-user-Desktop-MaiSha\memory\project_data_persistence_risk.md)）
- 收藏元素（印章/小猫，见 [memory/project_collectibles_idea.md](C:\Users\user\.claude\projects\C--Users-user-Desktop-MaiSha\memory\project_collectibles_idea.md)）
- App icon 重设
- 步骤切换的翻页动画（留到 v2）

---

## 2. 目标

1. Onboarding 第一画面就传递「手账」气质，跟 app 主界面视觉无缝衔接
2. 修复 3 个 UI bug：safe-area 适配、内容垂直定位、确认按钮可见性
3. 建立 wordmark 作为 app 的视觉签名，未来可在设置页、分享卡片等位置复用
4. 不增加 onboarding 步骤数（仍是 3 步）

---

## 3. 当前问题与对应修复

### Bug 1：内容偏下偏空

**现状：** [Onboarding.tsx:95](src/routes/Onboarding.tsx) 用 `flex: 1` + `justifyContent: 'center'` 让内容垂直居中。iPhone 16 Pro（6.3" 屏）上，标题悬浮在屏幕中部偏下，顶部空旷感强。

**修复：** 改为 `justifyContent: 'flex-start'`，并在 step dots 与内容之间加 `paddingTop: 40px`（mockup-journal.html 的节奏感）。让内容贴近上半屏，符合用户「自然向下读」的视觉路径。

### Bug 2：「下一步」按钮被截断

**现状：** [Onboarding.tsx:54-60](src/routes/Onboarding.tsx) 的容器用 `minHeight: '100vh'`。但 [index.css:11-17](src/index.css) 已经给 `body` 加了 `padding-top/bottom: env(safe-area-inset-*)`，再让 Onboarding 跑满 `100vh` 就等于 `safe-area-top + 100vh + safe-area-bottom`，**超出可视区域**。底部按钮就被推到 home indicator 区域（甚至屏幕底部之外）。

**修复：** 容器改用：

```css
minHeight: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))
```

这让 Onboarding **恰好填满** body 已经留出 safe-area padding 之后的内容区，按钮自然落在 home indicator 上方。

补充：因为 body 已经处理了 safe-area inset，Onboarding 容器**不再需要**额外加 `paddingTop/Bottom: env(safe-area-inset-*)`，否则双重补偿反而出现多余间距。容器自身的 padding 用普通数值即可（如 `padding: 24px`）。

### Bug 3：「确认」按钮太右边、不明显、用户不知道能继续加店铺

**现状：** [Onboarding.tsx:206-223](src/routes/Onboarding.tsx) 的「确认」按钮是条件渲染（`newStoreName.trim() && ...`），输入前根本不存在；存在时挤在输入框右侧，视觉重量轻。用户没有任何线索知道「可以继续添加多家店铺」。

**修复：**

1. 「确认」按钮**始终可见**：输入为空时呈现半透明灰色禁用态，有输入时变成珊瑚色 accent
2. 按钮内容从「确认」文字改成「+」图标（48×48 圆角方形），跟 app 其他地方的「添加」语义一致
3. 输入框下方加一行提示文字：「按回车或点 + 添加，可以继续添加多个」
4. 已添加的店铺以 mockup-journal 中的 `.store-card` 样式呈现（白底 + 多层柔阴影 + 微旋转 + 左边彩色 border），让「累积」可视化

---

## 4. 视觉系统（沿用 mockup-journal.html）

### 4.1 颜色（CSS 变量，应已在 :root 中定义）

```css
--paper: #FBF6EF;          /* 主背景，温暖纸张色 */
--paper-dark: #F3EBDD;     /* 卡片次背景 */
--ink: #4A3728;            /* 主文字，深棕墨色 */
--ink-light: #8B7355;      /* 次要文字 */
--ink-faint: #C4B49A;      /* 辅助/禁用文字 */
--accent: #D4836B;         /* 珊瑚红，主点缀色 */
--accent-soft: #E8AE97;    /* 珊瑚浅，下划线等 */
--green: #7BA37E;          /* 鼠尾草绿 */
--green-soft: #B5D1B7;     /* 浅绿 */
--blue: #7BA3B8;           /* 雾蓝 */
```

**实施前检查：** 这些变量来自 mockup-journal.html，需确认 [src/index.css](src/index.css) 或主 CSS 文件已实际定义。若未定义，本次需先补上。

### 4.2 字体

- **标题：** `'ZCOOL KuaiLe', 'Nunito', sans-serif` —— Google Fonts，免费可商用，手写中文 + 拉丁
- **正文：** `'Noto Sans SC', 'Nunito', sans-serif`
- **拉丁专用：** `'Nunito', sans-serif`

需在 `index.html` 或 CSS 入口 `@import` Google Fonts。

### 4.3 纸张纹理（背景层）

整个 onboarding 容器叠加一层 SVG 噪点纹理，跟 mockup-journal.html [50:line] 一致：

```css
background-image:
  url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"),
  linear-gradient(180deg, var(--paper) 0%, #F7F0E6 100%);
```

### 4.4 Washi 胶带素材（已生成，存放于 [public/decorations/](public/decorations/)）

| 文件 | 用途 |
|---|---|
| `washi-sage-botanical.png` | Step 1 欢迎卡顶部（开篇仪式） |
| `washi-coral.png` | Step 2 标题装饰 |
| `washi-blue.png` | Step 3 标题装饰 |
| `washi-blue-botanical.png` | Onboarding 完成动效（收尾呼应） |

**通用渲染规则：**
- 宽度 100-140px，高度按比例
- 旋转 -3° 到 -2°（手贴的随意感）
- `opacity: 0.85`
- 进阶可加 `mix-blend-mode: multiply` 让胶带跟纸张背景融合
- `pointer-events: none`（装饰元素不应拦截点击）

---

## 5. 详细设计

### 5.1 整体容器

```jsx
<div style={{
  minHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  background: 'var(--paper)',
  backgroundImage: '...',  // 见 §4.3
}}>
```

**注意：** body 已经处理了 safe-area 内边距（[index.css:11-17](src/index.css)），所以这里只用 `calc(100dvh - ...)` 把容器尺寸限定在可视区域，**不**重复加 `env()` padding。

### 5.2 Step indicator（替换原 step dots）

将原本的圆点改为 mockup-journal 的虚线分隔风格：

```jsx
<div style={{
  display: 'flex',
  gap: 4,
  justifyContent: 'center',
  marginBottom: 32,
}}>
  {Array.from({ length: TOTAL_STEPS }, (_, i) => (
    <div key={i} style={{
      width: i === step ? 32 : 16,
      height: 3,
      background: i <= step ? 'var(--accent-soft)' : 'var(--ink-faint)',
      borderRadius: 2,
      opacity: i <= step ? 0.7 : 0.3,
      transform: i === step ? 'rotate(-0.3deg)' : 'none',
      transition: 'all 0.3s',
    }} />
  ))}
</div>
```

### 5.3 Step 1：欢迎卡 + 语言选择

**结构（从上到下）：**

1. **Washi 胶带装饰**（`washi-sage-botanical.png`），宽 120px，旋转 -3°，相对 wordmark 偏左上 20px
2. **Wordmark 区**（居中）：
   - 「买啥」—— ZCOOL KuaiLe，56px，`var(--ink)`，letter-spacing 8px
   - 「MaiSha」—— Nunito，14px，`var(--ink-light)`，letter-spacing 3px，间距 wordmark 下 4px
   - 手绘下划线 —— 用 `::after` 伪元素或 div，3px 高，`var(--accent-soft)` 色，旋转 -0.5deg，宽度匹配 wordmark
3. **Slogan**：「去哪买，买点啥」—— Noto Sans SC，16px，`var(--ink-light)`，与 wordmark 间距 24px
4. **语言选择列表**（与 wordmark 间距 40px）：
   - 移除原 🌏 emoji
   - 按钮样式：白底，圆角 14px，`box-shadow: 0 2px 8px rgba(74, 55, 40, 0.06)`
   - 选中状态：左边 4px `var(--accent)` 立边，背景 `rgba(232, 174, 151, 0.12)`
   - 文字：Noto Sans SC，16px，`var(--ink)`
   - 选中指示：右侧 ✓ 改成 `var(--accent)` 色

### 5.4 Step 2：添加店铺

**结构（从上到下）：**

1. **标题装饰区**（居中）：
   - 「常去的店」—— ZCOOL KuaiLe，28px，`var(--ink)`
   - 手绘下划线，珊瑚色，旋转 -0.5deg
   - 上方贴 `washi-coral.png`，宽 100px，旋转 -3°，偏右 20px
2. **提示文字**：「你常去哪几家？后面可以随时改」—— Noto Sans SC，13px，`var(--ink-light)`，标题下方 8px
3. **已添加店铺列表**：
   - 每个 chip 是 mockup-journal 的 store-card 简化版：白底，圆角 14px，多层柔阴影，左 4px 彩色 border（珊瑚/绿/蓝循环），微旋转（-0.3deg / 0.2deg / -0.15deg 循环）
   - 内容：店名（ZCOOL KuaiLe 18px）+ 右侧 × 删除按钮（半透明，hover 时变珊瑚色）
4. **输入区**（贴在最后一个 chip 下方）：
   - 输入框：圆角 14px，1px 虚线 border `var(--ink-faint)`，白底，padding 10px 14px
   - 「+」按钮：48×48，圆角 14px，**始终可见**：
     - 空状态：`background: var(--ink-faint)`，`opacity: 0.4`
     - 有内容：`background: var(--accent)`，`opacity: 1`
     - 内容：白色 `+` 图标，24px
   - 输入框右侧 8px 间距
5. **提示文字**：「按回车或点 + 添加，可以继续添加多个」—— Noto Sans SC，12px，`var(--ink-faint)`，输入框下方 8px

### 5.5 Step 3：货币选择

**结构（从上到下）：**

1. **标题装饰区**（居中）：
   - 「用什么货币」—— ZCOOL KuaiLe，28px，`var(--ink)`
   - 手绘下划线，珊瑚色
   - 上方贴 `washi-blue.png`，宽 100px，旋转 -3°，偏左 20px
2. **货币网格** —— 沿用现有 2 列布局，但：
   - 按钮改为白底圆角 14px，与 Step 1 语言按钮同一套样式
   - 选中状态：左 4px `var(--blue)` 立边，背景浅蓝
   - 货币符号：ZCOOL KuaiLe，18px
   - 货币代码：Nunito，10px，`var(--ink-faint)`

### 5.6 底部按钮区

```jsx
<button style={{
  width: '100%',
  height: 52,
  borderRadius: 14,
  background: 'var(--green)',
  color: 'white',
  fontFamily: 'var(--font-body)',
  fontSize: 16,
  fontWeight: 700,
  boxShadow: '0 4px 12px rgba(123, 163, 126, 0.25)',
}}>
  {step === TOTAL_STEPS - 1 ? t('onboarding.done') : t('onboarding.next')}
</button>
```

「跳过」按钮（仅 Step 2）：
- 字号 13px，`var(--ink-light)`，下划线点状（dashed）
- 间距按钮下方 12px

### 5.7 完成动效

当用户在 Step 3 点击「开始使用」时：
- 在主按钮上方淡入显示 `washi-blue-botanical.png`（200ms fade，180ms 后整体跳转到 `/list`）
- 简单 fade，不做复杂动画（避免增加 v1 复杂度）

---

## 6. 文案（i18n）

需在 [src/locales/zh-CN.json](src/locales/zh-CN.json)、`zh-TW.json`、`en.json` 的 `onboarding` 节点新增/修改：

```json
{
  "onboarding": {
    "welcome": "欢迎使用买啥",
    "slogan": "去哪买，买点啥",
    "wordmark": "买啥",
    "wordmarkLatin": "MaiSha",
    "addStores": "常去的店",
    "addStoresHint": "你常去哪几家？后面可以随时改",
    "storePlaceholder": "输入店铺名称",
    "addStoreHelper": "按回车或点 + 添加，可以继续添加多个",
    "currency": "用什么货币",
    "next": "下一步",
    "skip": "跳过",
    "done": "开始使用"
  }
}
```

**翻译策略：**
- `wordmark` / `wordmarkLatin`：所有语言版本都保留「买啥 / MaiSha」（品牌名不翻）
- `slogan`：
  - zh-CN：「去哪买，买点啥」
  - zh-TW：「去哪買，買點啥」
  - en：「What to buy, where to go」（或留作 TBD 由用户最终决定）
- `addStores` / `currency` 用更短的诗意化文案，呼应手账气质

---

## 7. 实现影响

### 7.1 需要修改的文件

| 文件 | 改动 |
|---|---|
| [src/routes/Onboarding.tsx](src/routes/Onboarding.tsx) | 整体重写，约 320 行 → 估计 400 行 |
| [src/index.css](src/index.css) | 确认 / 补充 :root 颜色变量（若主 CSS 还没有，从 mockup-journal.html 移植） |
| [src/locales/zh-CN.json](src/locales/zh-CN.json) | 新增 slogan / wordmark / addStoreHelper 等键 |
| [src/locales/zh-TW.json](src/locales/zh-TW.json) | 同上 |
| [src/locales/en.json](src/locales/en.json) | 同上 |
| [index.html](index.html) | 添加 Google Fonts preconnect 和样式表链接：`<link rel="preconnect" href="https://fonts.googleapis.com">` / `crossorigin` 到 fonts.gstatic.com / `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Nunito:wght@400;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap">` |

### 7.2 新增的素材

```
public/decorations/
├── washi-coral.png            ← 已生成
├── washi-blue.png             ← 已生成
├── washi-blue-botanical.png   ← 已生成
└── washi-sage-botanical.png   ← 已生成
```

无需额外素材。

### 7.3 没有改动的部分

- Onboarding 逻辑（state、step 流转、localStorage 写入）保持不变
- [src/App.tsx](src/App.tsx) 的 FirstOpenRedirect 不变
- 数据层（Supabase 调用）不变

---

## 8. 测试要点

实施后需在以下设备/状态验证：

1. **iPhone 16 Pro（6.3"，Dynamic Island）** PWA standalone 模式：
   - Step dots 不被 Dynamic Island 遮挡
   - 「下一步」按钮完整可点击，离 home indicator 至少 16px
   - Wordmark 居中且不偏下
2. **iPhone SE（4.7"，小屏）** 浏览器：
   - 内容不溢出，仍能完整 3 步走完
3. **桌面浏览器**（max-w-mobile 限制下）：
   - 视觉缩放正常，washi 胶带不变形
4. **3 种语言切换**：
   - 简体中文、繁体中文、英文 wordmark 都用「买啥 / MaiSha」（品牌不翻）
   - Slogan 各语言版本显示正确

---

## 9. 待用户最终确认的小决策

实施时如果遇到，按以下默认值执行；如有不同想法可在 review 时提出：

1. **英文 slogan**：暂定「What to buy, where to go」，可后续替换
2. **Wordmark 是否每步都显示**：默认**仅 Step 1 显示**（Step 2/3 用各自的小标题 + washi 胶带承担视觉锚点）；如果想让 wordmark 一直在顶部，可在 review 时改
3. **跳过按钮位置**：保留在 Step 2 下方，文案改为「先这样，回头再加」更温和
4. **货币布局**：保持 2 列网格，不改 grid

---

## 10. 不在本次范围

- 数据持久化恢复机制（critical，但单独 brainstorm）
- 收藏元素（印章/小猫）
- App icon 重设
- 步骤切换的页面翻动动画
- 触觉反馈（haptic feedback via Capacitor）
- 完成时的水彩绽放动效（v2 候选）
