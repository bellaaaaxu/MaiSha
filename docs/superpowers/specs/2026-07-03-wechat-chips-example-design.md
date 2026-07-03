# 微信引导条 + 店铺 chips + 示例清单 — Design Spec

**Date:** 2026-07-03
**Status:** Approved（三项形态决策 2026-07-03 用户拍板，引导条经 mockup 确认选 A）

三件上架前小活打包。共同点：都是"第一次接触"体验（微信里第一眼 / onboarding 第一分钟 / 清单第一屏）。

## 1. 微信引导条（方案 A：常驻细条 + 点开全屏指引）

**问题**：微信内置浏览器 localStorage 隔离 → 匿名身份分裂（见 memory `wechat-webview-identity-split`）。本 spec 是**最小版**：引导用户去真浏览器；完整身份迁移（join/recovery code 桥接、Universal Links）留 v1.1。

### 组件 `src/components/WechatBanner.tsx`

- 检测：复用 `uaEnv()`（`@/utils/analytics-core`，已有单测）；非 wechat 返回 null。props `{ ua?: string }` 默认 `navigator.userAgent`（可测性）。
- **细条**：普通文档流（非 fixed），置于 AuthedApp 容器顶部、`<Routes>` 之上 → 微信内**所有页面**常驻、把内容下推不遮挡；不可关闭（因为不挡内容）。暖纸色调（`#fdf3e4` 底 / `#7a5a38` 字 / 细底边），文案 `wechat.banner`，尾部 ›。
- **点击细条 → 全屏指引蒙层**（fixed inset-0，zIndex 1200 压过一切弹层；`rgba(40,30,20,.72)` 背景）：右上角大 ↗ 字符 + 「点右上角 ⋯ 菜单」提示；下方水彩卡（NoticeModal 同款渐变容器）：标题、步骤 1（点右上角 ⋯）、步骤 2（选「在浏览器打开」/「在 Safari 打开」）、说明（微信里的记录换手机会丢；浏览器打开后可「添加到主屏幕」，全家永远同步）、绿色「我知道了」关闭。可随时经细条重新打开，无需 localStorage 记忆。
- i18n：`wechat.banner / title / step1 / step2 / note / ok` 三语。
- 测试：组件测试——微信 UA 渲染细条、Safari UA 渲染 null、点击细条出现指引、点「我知道了」关闭。

## 2. 店铺快选 chips（按语言三套、北美优先）

### `StorePicker` 增加可选 prop `suggestions?: string[]`

- 输入框下方渲染换行 pill 行；**点击切换**：未添加 → 加入（id 推导与手输一致：`name.toLowerCase().replace(/\s+/g,'-')`）；已添加 → 移除。
- 视觉：未选=白底虚线边暖灰字；已选=`rgba(124,169,130,.18)` 底 + 绿边 + ✓ 前缀。
- 不传 prop 时零变化（NewListSheet 不受影响，本期不给）。

### 名单（Onboarding 内常量，按 `i18n.resolvedLanguage` 选套）

| 语言 | chips（8 个） |
|---|---|
| zh-CN | 大统华 T&T · 大华 99 Ranch · H Mart · Costco · Walmart · 盒马 · 山姆 · 菜市场 |
| zh-TW | 大統華 T&T · 大華 99 Ranch · H Mart · Costco · Walmart · 全聯 · 家樂福 · 菜市場 |
| en（兜底） | T&T · 99 Ranch · H Mart · Costco · Walmart · Superstore · Trader Joe's · Whole Foods |

店名是专有名词数据、非 UI 文案，常量置于 Onboarding.tsx，不进 locale 文件。

## 3. 新用户示例清单（3 件真商品 + 轻引导）

### 注入点：`db.getOrCreatePrimaryList`

- 仅在**创建**新清单分支执行（已验证：邀请加入者走 `joinOrGetList`，永不到达此分支）。
- 清单插入成功后 `try { 批量插入 3 件示例商品 } catch { /* 非关键，失败不影响建单 */ }`。
- 归属店铺：`supermarkets` 中第一个非 `none` 的店（onboarding 首选店）；用户跳过选店则归 `none`。
- 语言：读 `localStorage['maisha:language']`（onboarding 刚写入），fallback zh-CN。

### `src/utils/example-items.ts`（纯函数 + 单测）

`buildExampleItems(lang, supermarketId)` → 3 行：

| 语言 | 商品（首件带备注引导） |
|---|---|
| zh-CN | 鸡蛋〔备注：点左边圆圈试试打勾〕· 牛奶 · 西红柿 |
| zh-TW | 雞蛋〔備註：點左邊圓圈試試打勾〕· 牛奶 · 番茄 |
| en | Eggs〔note: Tap the circle to check it off〕· Milk · Tomatoes |

- 图标：zh 名精确命中预设水彩；zh-TW 经 `normalizeName` 繁→简折叠命中；en 名无 alias → WatercolorFallback（三层降级的既定行为，可接受）。
- 商品名是种子数据（须与图标 alias 匹配），文案内嵌 util 按 lang switch，不进 locale。
- 不触发 `add_item` 埋点、不进常买记录（两者都挂在 UI 层，db 层插入天然绕过）✓。

## 4. Non-goals

- 完整微信身份迁移（code 桥接 / Universal Links）→ v1.1
- NewListSheet 的 chips、coach marks / tour 其余形态
- 示例商品的"一键清空"专门入口（用户勾掉/删掉即毕业，已有交互足够）

## 5. 验收

- [x] 微信 UA：细条渲染/点开指引/关闭、非微信零渲染（WechatBanner 组件测试 ×3）
- [x] onboarding 店铺步骤 8 个 chips；点击加入（✓ 高亮 + 行出现）/再点移除（preview 实测 + StorePicker 测试 ×3）
- [x] 全新用户首单注入 3 件示例商品 + 首件引导备注（preview 全新档案实测：鸡蛋/牛奶/西红柿 + 备注全部在场）；副作用加分：itemCount≥3 使找回码卡片对新用户立即曝光
- [x] typecheck + 159 测试全过（example-items ×4 / WechatBanner ×3 / StorePicker ×3 新增）
- [x] 落地补记：dev 实测发现 FirstOpenRedirect 在渲染期写 `maisha:seen`，StrictMode 双渲染下 dev 环境会跳过 onboarding（生产单渲染不受影响）——修复挂 ROADMAP 推后
