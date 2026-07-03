# 设置区死链修复 — Design Spec

**Date:** 2026-07-02
**Status:** Approved（三项方向决策 2026-07-02 用户拍板）

## 1. 问题

1. **语言切换失效（上架阻塞）**：SettingsDrawer「语言设置」「导入 / 导出」nav 到 `/settings/language`、`/settings/import-export`，路由表无此二路由，被 `*` 兜底静默弹回 /list。三语 app 上完 onboarding 后无任何途径改语言。
2. **孤儿路由 `/settings`**（Settings.tsx）：无入口引用、全页硬编码中文。牵连发现：它是两个功能的唯一入口——**输入邀请码加入**（`nav('/join')` 普通模式，收到邀请码但没有可点链接的接收方需要它）和**找回码常驻展示**（RecoveryCodeCard 可被永久 dismiss 且仅 ≥3 件商品时出现）。直接删除会制造新孤儿。
3. 孤儿功能「复制清单文本」（`generateShareText`，把清单发给不用 app 的家人）唯一调用方也是 Settings.tsx。

## 2. 决策（2026-07-02 拍板）

1. **语言设置 = 抽屉内弹层**（LanguageSheet）：复用 onboarding 第一步三键 UI，选完即生效即关；i18n 已由 LanguageDetector 自动持久化到 `localStorage['maisha:language']`，无需额外存储。
2. **导入 / 导出拆成两个菜单项**：「导入文本」→ 打开现有 ImportSheet；「复制清单文本」→ `generateShareText` → 剪贴板 + NoticeModal 确认（救回导出）。不新建中间面板。
3. **删除 Settings.tsx + `/settings` 路由**；抽屉补两个入口承接其独有功能：「找回码」（点击 = 复制 + 弹层展示，顺带解决 ROADMAP「Recovery code 展示打磨」的常驻入口问题）和「输入邀请码加入」（→ `/join`）。抽屉成为唯一设置中枢。

## 3. 设计

### 3.1 新组件 `src/components/LanguageSheet.tsx`

- 居中水彩弹层（ConfirmModal 同款视觉容器）；三个语言按钮（简体中文 / 繁體中文 / English，native label 不走 i18n），当前语言 ✓ + `aria-pressed`（沿用 Onboarding 模式）。
- 点击：`i18n.changeLanguage(code)` → 自动持久化 → `onClose()`。
- Props：`{ open, onClose }`，自包含（只依赖 react-i18next）。

### 3.2 SettingsDrawer 菜单（改造后）

| # | 项 | 行为 | key |
|---|---|---|---|
| 1 | 语言设置 | 打开 LanguageSheet | `settings.language`（现有） |
| 2 | 图标库 | `/icons`（不变） | `settings.iconLibrary` |
| 3 | 导入文本 | `onOpenImport()` 回调（List 打开 ImportSheet） | `settings.importText`（新） |
| 4 | 复制清单文本 | `onCopyText()` 回调（List 复制 + 弹层） | `settings.exportText`（新） |
| 5 | 店铺管理 | `/manage-stores`（不变） | `settings.personalPresets` |
| 6 | 找回码 | 抽屉内自包含：`getCachedAccount()` → 复制 + 弹层（无账号缓存时隐藏该项） | `settings.recoveryCode`（新） |
| 7 | 输入邀请码加入 | `/join`（普通模式，救回接收方入口） | `settings.joinByCode`（新） |
| 8 | 隐私与条款 | `/privacy`（不变） | `settings.privacy` |
| 9 | 联系我们 | mailto（不变） | `settings.contact` |
| — | 清空清单 | 不变（destructive 分区） | `settings.clearList` |

- 抽屉内部把 `clearFailed: boolean` 升级为通用 `notice: { title?, message } | null`，清空失败与找回码两条路径共用一个 NoticeModal。
- 找回码弹层文案：`recoveryCopied`\n\ncode\n\n`recoveryHint`（沿用原 Settings 文案语义，i18n 化）；剪贴板被拒 → 弹层直接展示 code（可选中），与分享兜底同模式。

### 3.3 List.tsx 接线

- `SettingsDrawer` 新增 props：`onOpenImport`（→ `setShowImport(true)`）、`onCopyText`（→ `generateShareText(items, list.supermarkets)` → 剪贴板 → 已有 `notice` 弹层确认；被拒 → 弹层展示全文可选中）。

### 3.4 删除

- `src/routes/Settings.tsx`、App.tsx 的 import + `/settings` 路由行。
- i18n key `settings.importExport`（三语）随之移除——不留死 key（share.* 的教训）。
- `share-text.ts` 保留（被救回的导出调用）。

### 3.5 新增 i18n key（settings 节，三语）

`importText`、`exportText`、`textCopied`（清单文本已复制）、`recoveryCode`（找回码）、`recoveryCopied`（找回码已复制）、`recoveryHint`（换手机或重装时，用它找回清单）、`joinByCode`（输入邀请码加入）。

## 4. Non-goals

- 不改 onboarding；不动 RecoveryCodeCard（首曝逻辑属「Recovery code 展示打磨」剩余部分）；不做语言以外的新设置项；不重建 /settings 路由页。

## 5. 验收

- [x] 抽屉「语言设置」→ 弹层切 English → 全 UI 即时切换、`maisha:language` 持久化；切回 zh-CN 同理（2026-07-02 浏览器实测）
- [x] 「复制清单文本」复制成功弹确认（「导入文本」走 List 现有 ImportSheet 接线）
- [x] 「找回码」复制 + 弹层展示（含 hint 与码本体）；「输入邀请码加入」到达 /join 普通模式
- [x] `/settings` 直接访问被兜底重定向回 /list（路由已删）
- [x] typecheck + 145 测试全过（LanguageSheet 组件测试 ×2）
- [x] 顺带修复：ConfirmModal/NoticeModal z-50 → 1100——原先从抽屉打开的「清空清单」确认层被抽屉背板（z999/1000）盖住，属既有 stacking bug，实测已浮到最上层
