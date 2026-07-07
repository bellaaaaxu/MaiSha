# 长尾兜底换装：梅兰竹菊装饰系 + 首字角标 — Design Spec

**Date:** 2026-07-05
**Status:** Approved（方向 2026-07-05 用户拍板；梅兰竹菊 4 只试装批已过目，撞形/版权/时间轴三轮论证见 ROADMAP 弊端条目）

## 0. 决策背景（为什么换）

食物小人班底最小版（2026-07-05 上线）暴露两条结构性弊端（ROADMAP 已记档）：撞脸读作 bug、语义分配单向门窗口正在关闭；另有食物脸贴非食品的违和雷（泻药/杀虫剂配笑脸点心）。根因是**小人是「描绘」（depiction）——错误地声称「这件商品是茶叶蛋」**。本方案改用**「装饰」（decoration）框架**：手账贴纸不声称任何事，三个问题一起消解——撞图=「同一张贴纸用了两次」（手账天经地义）、语义窗口失效（装饰不需要匹配品类）、违和消失（花贴在泻药旁完全中性）。识别功能由**首字角标**补齐（旧文字色块有、小人没有的能力，本方案拿回来）。

主题选梅兰竹菊雅集词汇：公有领域纹样（版权排雷结论见 ROADMAP）、无脸与 Tier 1 写实层同语言、剪影多样性可控、季节属性天然喂图鉴。**替换窗口**：班底层不写任何 DB（纯渲染层），当前替换成本为零。

## 1. 花名册（12 只，等权重）

| id | 名 | 剪影/颜色特征（角色行素材） | 剪影类型 |
|---|---|---|---|
| mei | 梅 | 深褐枝干斜出，缀粉红五瓣梅花与花苞 | 枝＋花 |
| lan | 兰 | 细长弯垂墨绿叶，两朵淡紫白兰花 | 弧叶丛 |
| zhu | 竹 | 两三竿翠竹，竹节分明，斜出竹叶 | 竖竿 |
| ju | 菊 | 金黄多层细瓣菊花微侧，衬一片绿叶 | 密瓣团 |
| song | 松 | 一枝松枝，针叶成簇，缀一颗松果 | 针簇 |
| he | 荷 | 粉荷花大瓣半开，旁立一只绿莲蓬 | 大瓣＋蓬 |
| gui | 桂 | 一枝桂花，米黄小花簇生于对叶间 | 碎花簇 |
| yinxing | 银杏 | 两三片金黄扇形银杏叶 | 扇叶 |
| feng | 枫 | 一两片橙红掌形枫叶 | 掌叶 |
| shuixian | 水仙 | 白瓣黄芯水仙一两朵，直挺细叶 | 白瓣直叶 |
| ziteng | 紫藤 | 一串淡紫紫藤花自上垂落 | 垂串 |
| luwei | 芦苇 | 两三支芦苇，绒穗微弯 | 穗 |

- **铁律（沿袭班底）**：`id` 一经上线**永不改名**（rendezvous 分配依赖）；扩池只增不改，老商品要么保持原贴纸、要么换到新成员，绝不互相洗牌。
- **无脸铁律（新）**：纯植物，没有脸、没有眼睛、不拟人——与 Tier 1「永远没脸」统一为同一门语言。
- **撞形判定**（替代撞脸判定）：「缩到 44px、放进同一列表，一眼能区分」——圆瓣团型（菊/牡丹/山茶/芙蓉）**至多取一**（已取菊）；枝+粉花型至多取一（已取梅，海棠/桃花不进）。
- 12 只等权重（weight 全 1）：队长加权是品牌露脸需求，装饰层不需要；weight 字段保留供未来用。
- 试装批 4 只定稿沿用：梅 v1 / 兰 v1 / 竹 v1 / 菊 v3（`mascot-staging/trial-mlzj/`）；**兰已知 44px 最弱**，实施时先按「花更大、叶更少」重生成一轮，若仍糊则接受 v1。

## 2. 组件与渲染

### `src/utils/decor-registry.ts`（由 mascot-registry.ts 更名改造）

- `DECOR_MEMBERS: DecorMember[]`（12 花，接口同 MascotMember）；`assignDecor(name, members?)` 沿用 rendezvous + FNV-1a + fmix32（终混教训保留注释）；`decorUrl(member)` → `/flora/<file>.webp`。
- 单测全数迁移：稳定性、繁简归一、扩池不换贴纸、分布均匀（等权重版：12 成员各 ≈ 1/12 ± 容差）、url 格式。

### `src/components/DecorFallback.tsx`（替代 MascotFallback）

- **无晕染底**：花图 alpha 透明直贴，与预设图标的裸 `<img>` 同语言（小人的 blob 底随小人退役）。
- 花图占 `size × 0.94`（无脸无底，可以撑满）；**不加 `loading="lazy"`**（教训见 2026-07-05 fix commit）。
- **首字角标**：右下角纸片 chip——`width/height ≈ size × 0.42`，圆角 30%，底 `#fffdf7`、边 `1px solid #d5cbbe`、轻微 `rotate(-6deg)` 和纸感；字用 `'ZCOOL KuaiLe', cursive`（已在 Google Fonts 加载链），色 `#4a4540`。
- 角标字符：新增 `getMonogram(name)`（`src/utils/image-utils.ts`，纯函数+单测）——CJK 取首字；拉丁取首字母大写；空串返回 '·'。
- `onError` 回退链保留：花图加载失败 → `WatercolorFallback`（文字色块，最后防线，组件不删）。
- 测试：分配一致（img src = decorUrl(assignDecor(name))）、角标字符 zh/en、onError 回退。

### 接线

6 个调用点 `MascotFallback` → `DecorFallback`（ItemRow / ItemGrid / ShoppingMode ×2 / StoreFinder / AddSheet ×2 / IconPickerPanel），props 不变。`resolveIconUrl` 优先级链路零改动（custom → preset → null→DecorFallback）。

## 3. 资产管线

- `scripts/generate-flora.mjs`：试装脚本（scratchpad）正式化入库——12 花角色行 + 无脸约束句 + **风格块一字不改**（同一只手）；每只 3 变体；contact sheet 含 44px/28px 预览。已定稿 4 只跳过，本轮补 8 只 + 兰重生成 = 27 调用。
- `scripts/compress-flora.mjs`：抄 compress-mascots.mjs（边缘取样自适应底色 flood-fill + 256² WebP q85），`mascot-staging/flora-final/*.png` → `public/flora/*.webp`。预算：12 × ~10KB ≈ 120KB（precache 无压力）。
- 筛选标准：无脸合规 + 44px 撞形判定 + 同手水彩；每只 1 张定稿。

## 4. 食物小人退役安置

- 代码：`MascotFallback.tsx` / `mascot-registry.ts` 及其测试**删除**（git 历史永存）；`public/mascots/` 整目录移出（11 × 9KB 退出 precache）——`docs/brand/xiaorongbao-canonical.webp` 不动，仍是品牌定妆锚点。
- 定稿 PNG 留在 `mascot-staging/final/`（未跟踪）备收藏品用；ROADMAP 收藏品条目已规划班底作图鉴角色层，届时按需重压入库。
- **一张图不浪费**：onboarding/空状态/完成庆祝/图鉴 C 位是小人的既定主职（宪法 §8.3），只是退出商品图标位。

## 5. 文档同步（同 session 落地）

- project-design.md §8 修订：Tier 2/3 改「梅兰竹菊装饰系 + 首字角标」；班底条目标注「退役至品牌层/图鉴层（2026-07-05）」；§8.5 增花卉 prompt 模板。
- ROADMAP：弊端 #1/#2 条目标注处置结论（装饰框架消解）；「进行中」挂本 spec 实施条目。

## 6. Non-goals

- **节气采购章 / 收藏品图鉴**——自己的 brainstorm（ROADMAP 已记方向），不在本 spec。
- **IconPickerPanel 文案 i18n 收编**——ROADMAP 既有推后条目，顺带改「使用文字」语义另议。
- **按品类语义路由**——装饰框架下不再需要，此问题随本方案关闭。
- **预设目录扩容（方案 E）**——独立可并行的治本项，种子数据到位后另立。
- 口香糖→白糖类 substring 误匹配修正——既有匹配逻辑的独立议题。

## 7. 验收

1. 单测全绿（decor-registry ≥5、DecorFallback ≥3、getMonogram ≥3、既有 159 不回归）；typecheck/build 干净。
2. 44px 走查：12 花并排 contact sheet，任意两只一眼可辨；兰重生成后复验。
3. preview 冒烟：长尾商品见「花 + 首字角标」；同名同贴纸；预设/自定义优先级不破坏；后台标签页图片正常加载（无 lazy）。
4. precache：public/flora ≤ 150KB，public/mascots 已移出，build manifest 无 mascots 残留。
5. 撞图观感抽查：人为造两件同花商品，确认角标首字不同即可区分。
