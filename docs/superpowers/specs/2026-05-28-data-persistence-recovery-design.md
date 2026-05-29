# 数据持久化与找回（账号锚定）

**日期：** 2026-05-28
**范围：** 让 MaiSha 用户在 localStorage 被清掉后仍能找回云端数据；把找回锚定在一个轻量「账号」实体上，而非单个清单
**目标：** 上架前消除「清缓存 = 数据彻底消失」的架构性风险，且不破坏零注册体验

---

## 1. 背景

MaiSha 用 Supabase 匿名用户保存数据，session **只存在 localStorage**（[supabase.ts:13](src/lib/supabase.ts:13) `persistSession: true`），活动清单 id 也只存 localStorage（[useList.ts:5](src/hooks/useList.ts:5) `maisha:list-id`）。

**失败路径（已对照代码核实）：** localStorage 被清（iOS Safari ITP 7 天未访问、PWA 删后重装、iOS 存储压力清理）后——

1. session 没了 → `signInAnonymously` 生成**全新匿名 uid**（[auth.ts:7](src/lib/auth.ts:7)）
2. `maisha:list-id` 也没了 → [useList.ts:32](src/hooks/useList.ts:32) 调 `getOrCreateList`，找不到归属新 uid 的清单 → **新建一个空清单**
3. 旧清单仍在云端，但新 uid 既不在它的 `member_uids` 里、也没有指针指向它 → 表现为「商品全没了、自定义店铺没了、AI 图标没了」

用户已于 2026-05-27 在 iPhone 16 Pro PWA 上多次实际遇到此问题。

**关键现状：找回原语其实已基本就绪。** 每个清单都有唯一 6 位 `short_code`（[005_short_code.sql](supabase/migrations/005_short_code.sql)），有 `join_by_code` RPC 和现成的 [JoinByCode.tsx](src/routes/JoinByCode.tsx) 输入界面，`join_by_code` 会把调用者 uid 追加进 `member_uids` → RLS 立刻恢复全部读写。**真正缺的是两件事：**

1. **持久性** —— 清 localStorage 后没有任何东西活下来指回旧数据。
2. **知晓度** —— 个人用户从不点开分享流程，不知道码的存在。

**为什么锚定「账号」而非「单清单」：** 把找回锚在某一个清单的 `short_code` 上，只在「一个人 = 一个清单」时成立。一旦未来一个人有多个清单 + 共享图标库，「找回」要恢复的是名下**所有**清单——那是账号尺度。身份模型是「现在（还没有真实用户）改最便宜、上架后改最痛」的部分，因此本次就把它钉在账号尺度上，即便上架仍只暴露单清单 UI。

---

## 2. 目标与非目标

**目标：**

1. 常见数据丢失场景（重装、换机、存储清理）在 iOS 上**无感自动找回**。
2. 所有平台（含 PWA、Android、iCloud 关闭的 iOS）都有一个**温和的手动找回码**兜底，无人裸奔。
3. 身份/找回锚定在账号尺度，未来多清单**零身份迁移**。
4. 保持零注册：账号自动匿名创建，用户永不「注册」。
5. 不破坏云端已有的 dogfood 数据。

**本次不处理（已与用户对齐，单独追踪）：**

- **图标库挪到账号级 + 「共享清单时用谁的库」协作语义** —— 留给「多清单」brainstorm。图标库暂保持 list 级（[custom_icons.list_id](supabase/migrations/003_custom_icons.sql:6)），它在找回里**已被保护**（恢复账号 → 恢复清单 → 恢复图标）。
- **多清单 UX**（家里/办公室/妈妈家）—— 单独 brainstorm。本次 schema 允许 N 个清单，UI 仍只露 1 个。
- **Apple Sign In / 真实账号升级** —— 上架后再说，本设计为其留位（账号实体即升级落点）。
- **Android Block Store** —— Android 正式做时再补，镜像 iOS 的 `DurablePointerStore` 接口。
- **`ai_generation_log` 对齐到账号级**（让 AI 额度跟账号走、防止 wipe 刷额度）—— 低优先，随图标库一起到多清单 brainstorm。
- **收紧「任意已登录用户可读任意 list」的宽 RLS（005）/ claim 限流** —— 见 §11 已知风险。

---

## 3. 核心设计：三层 + 一个抽象

```
Layer 0  身份锚点：accounts 实体（账号），找回锚定于此
Layer 1  通用兜底：账号 recovery_code = 「找回码」，温和呈现，任意平台可手动恢复
Layer 2  iOS 无感：iCloud KVS 存账号指针，重装/换机自动 claim 恢复
         ↑ 两层背后是平台无关的 DurablePointerStore 抽象，bootstrap 逻辑只写一遍
```

- **两个码正式分家**：账号 `recovery_code` = **找回码**（找回名下一切）；清单 `short_code` = **邀请码**（邀家人进某个清单，保持不变）。
- **自动找回是 iOS-only**（iCloud 是 Apple 独有），与「iOS 优先、Android 以后」的平台策略一致。Android / PWA / iCloud 关闭的 iOS 全部由 Layer 1 找回码兜住。

---

## 4. 数据模型

### 4.1 新增 `accounts` 表

```sql
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code TEXT UNIQUE NOT NULL DEFAULT generate_recovery_code(),  -- 8 位，见下
  member_uids   UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `recovery_code` 用 8 位（沿用 005 的无歧义字母表 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`，≈ 31⁸ ≈ 8500 亿组合）——比清单邀请码（6 位）更高熵，因为它授予整个账号的访问权。新增 `generate_recovery_code()`（结构同 [generate_short_code](supabase/migrations/005_short_code.sql:5)，长度 8）。
- `member_uids` 与清单同构：每次 wipe + 找回会追加一个新匿名 uid（体量极小，可接受）。

### 4.2 `lists` 增列

```sql
ALTER TABLE lists ADD COLUMN account_id UUID REFERENCES accounts(id);
-- 回填后置为 NOT NULL（见 §8 迁移）
```

- 清单归属一个账号。`lists.member_uids` 与 `lists.short_code` **保留**——用于跨账号把单个清单分享给家人（家人成为 list 成员，但不进你的账号）。

### 4.3 访问授权：claim 时把 uid 加入清单成员（不重写 RLS）

**不广义化现有 RLS**——在有真实数据的线上库上重写策略风险高，且 custom-icons storage bucket 的上传/删除策略仍按 list 成员判断（[003:80](supabase/migrations/003_custom_icons.sql:80)），单靠 RLS 级联并不完整。取而代之：`claim_account`（§4.4）把找回的 uid **同时加进账号 `member_uids` 和该账号名下所有清单的 `member_uids`**，使其成为各清单的**直接成员**。于是 lists / items / custom_icons / purchase_history 以及 storage bucket 的**全部现有成员制策略原样生效，一条都不用改**——线上迁移风险最低。

- `accounts` 需新增 RLS：
  - `SELECT/UPDATE USING (auth.uid() = ANY(member_uids))`
  - `INSERT WITH CHECK (auth.uid() = ANY(member_uids))` —— 否则 `createAccount` 会被挡。
- `lists` 的 INSERT 策略（001 现为 `owner_uid = auth.uid() AND auth.uid() = ANY(member_uids)`）追加：`AND account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids))`，防止把新清单挂到他人账号下。
- 代价：`lists.member_uids` 每次找回追加一个（死）uid——见 §10；死 uid 无法登录，无安全影响。

### 4.4 `claim_account` RPC

```sql
CREATE OR REPLACE FUNCTION claim_account(p_code TEXT)
RETURNS accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account accounts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_account FROM accounts WHERE recovery_code = upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;          -- 码不存在

  -- 加入账号成员
  IF NOT (auth.uid() = ANY(v_account.member_uids)) THEN
    UPDATE accounts SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
      WHERE id = v_account.id RETURNING * INTO v_account;
  END IF;

  -- 喷到账号名下所有清单，使现有成员制 RLS 原样生效（含 storage）
  UPDATE lists SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
    WHERE account_id = v_account.id AND NOT (auth.uid() = ANY(member_uids));

  RETURN v_account;
END;
$$;
```

---

## 5. Durable pointer 抽象

```ts
// src/lib/durable-store.ts
export interface DurablePointer {
  accountId: string;
  recoveryCode: string;
  activeListId?: string;   // 上次活动清单，找回后跳回正确清单
}
export interface DurablePointerStore {
  save(p: DurablePointer): Promise<void>;
  load(): Promise<DurablePointer | null>;
  clear(): Promise<void>;
}
```

- **Web/PWA impl**：no-op（`load` 返回 `null`）→ 自动落到 Layer 1 找回码。
- **iOS impl**：经 `KVStore` 插件读写 `NSUbiquitousKeyValueStore`（§6）。
- **Android impl**：现在 no-op；将来换 Block Store。
- 运行时按 `Capacitor.getPlatform()` 选实现。

---

## 6. iCloud KVS 自写薄插件（Layer 2，iOS）

**为什么是 KVS：** `NSUbiquitousKeyValueStore` 是 Apple 文档明确「数据在重装之间保留」的 API（登录同一 iCloud 账号即可），并自动同步到用户其它设备；上限 1MB / 1024 键 / 键名 64 字节，我们只存几十字节指针，绰绰有余。`UserDefaults`/Capacitor Preferences 在卸载时会被清掉，故不可用。([Apple 文档](https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore))

**插件接口（TS）：**

```ts
KVStore.set({ key: string, value: string }): Promise<void>
KVStore.get({ key: string }): Promise<{ value: string | null }>
KVStore.remove({ key: string }): Promise<void>
// 冷启动用：iCloud 把数据推下来时触发
KVStore.addListener('didChangeExternally', (data) => void)
```

**Swift 要点（完整代码进实施计划）：** 桥接 `NSUbiquitousKeyValueStore.default` 的 `set/string(forKey:)/removeObject` + `synchronize()`；监听 `NSUbiquitousKeyValueStore.didChangeExternallyNotification` 并 `notifyListeners('didChangeExternally', ...)`。约几十行。

**Xcode：** 开启 iCloud capability → 勾选 **Key-value storage**（实施计划给截图级步骤）。

---

## 7. Bootstrap / 启动数据流

替换现有 [useAuth](src/hooks/useAuth.ts) + [useList](src/hooks/useList.ts) 的启动逻辑（合并/扩展，具体拆分进实施计划）：

```
uid = getOrCreateAnonymousSession()

// ── 解析账号 ──
account = findAccountForUid(uid)                 // accounts where uid = ANY(member_uids), limit 1
if (!account) {
  pointer = await durableStore.load()            // iCloud KVS（冷启动宽限见下）
  if (pointer) account = await claimAccount(pointer.recoveryCode)
}
if (!account) account = await createAccount(uid) // 真·新用户：建账号

// ── 解析活动清单 ──
listId = urlJoinListId                           // 1. 点了分享链接（最高）
      || localStorage['maisha:list-id']          // 2. 正常热启动
      || pointer?.activeListId                    // 3. 从 KVS 恢复的上次清单
list = listId ? await joinOrGetList(listId)
              : await getOrCreatePrimaryList(account, uid)  // 4. 账号下首个清单

persistActiveList(account, list)                 // 镜像写 localStorage + durableStore
```

**修掉空清单 bug 的关键：** 第二步「解析账号」在「建新清单」之前；KVS 有指针时先 `claim_account` 恢复账号，于是 `getOrCreatePrimaryList` 会找到账号已有的清单，而非新建空清单。

**⚠️ 本设计唯一需要小心处：冷启动宽限。** 全新安装时 KVS 本地缓存可能尚未从 iCloud 同步下来，`load()` 立刻读可能返回 `null`。处理：**仅在 localStorage 完全为空、且 `findAccountForUid` 无果的冷启动路径**上，订阅 `didChangeExternally`、最多等 ~1.5s（由 splash screen 遮住），等 iCloud 推下来再决定是否「建新账号」。热启动（localStorage 有值）完全不走这条，无延迟。

**`active-list.ts`（新）—— 收口写入：** `persistActiveList(account, list)` 同时写 `maisha:list-id`、`maisha:account` 和 `durableStore.save({accountId, recoveryCode, activeListId})`；`clearStoredList()` **只清 `maisha:list-id`**（保留缓存账号，使找回后 bootstrap 落到账号首清单）。写入侧不变量：durable store 镜像 localStorage 的当前指针 —— 注意 iOS 上 durable 指针**有意**在 localStorage 被清后仍存活（这正是找回机制），故该镜像是写入侧、非双向。现散落的 `localStorage.setItem(STORAGE_KEY,…)`（[useList.ts:23/34](src/hooks/useList.ts:23)、[JoinByCode.tsx:29](src/routes/JoinByCode.tsx:29)）全部收口到此。

---

## 8. 数据迁移 `009_accounts.sql`

云端已有 dogfood 数据，走**附加式、不破坏数据**的迁移：

```sql
-- 1. generate_recovery_code() + accounts 表（§4.1）
-- 2. lists 增列 account_id（nullable）
ALTER TABLE lists ADD COLUMN account_id UUID REFERENCES accounts(id);
-- 3. 为现有每个清单建一个账号，继承其成员
DO $$
DECLARE r RECORD; new_id UUID;
BEGIN
  FOR r IN SELECT id, member_uids FROM lists LOOP
    INSERT INTO accounts (member_uids) VALUES (r.member_uids) RETURNING id INTO new_id;
    UPDATE lists SET account_id = new_id WHERE id = r.id;
  END LOOP;
END $$;
-- 4. 置 NOT NULL
ALTER TABLE lists ALTER COLUMN account_id SET NOT NULL;
-- 5. accounts 的 RLS（§4.3）+ 重建 lists INSERT 策略加 account 归属校验
-- 6. claim_account() RPC（§4.4，含向账号名下清单喷 member）
-- 不改 items / custom_icons / purchase_history / storage 的任何策略。
```

迁移后：每个现有清单各得一个账号（成员继承），自动生成找回码。用户自己的清单**不会丢**。

---

## 9. 找回码 UX（Layer 1，温和不打扰）

- **设置 / 清单信息**：展示**账号找回码** + 复制按钮 + 一句温和文案「换手机或重装，输入它就能找回你的清单」。与「分享/邀请家人」（用清单 `short_code`）是**不同的按钮和文案**，避免两码混淆。
- **找回入口**：复用 [JoinByCode.tsx](src/routes/JoinByCode.tsx) 的输入界面（带一个 `mode` 区分意图）。**按入口/意图区分，不靠解析码内容**：
  - 「恢复我的清单」（onboarding / 空状态低调露出）→ `claim_account(recovery_code)`
  - 「加入家人清单」（现有邀请流程）→ `join_by_code(short_code)`
- **一次性温和卡片**：用户累计 **≥3 个商品**（有了值得保护的数据）后，出一张**可关掉**的小卡片，提一次找回码，关掉不再来（`maisha:recovery-card-dismissed`）。符合「温和不打扰」。阈值可调。

---

## 10. 边界与错误处理

- **iCloud 关 / 不可用**：`durableStore.load()` 返回 `null` → 落到找回码，不崩。
- **孤儿空清单**：真·新用户建了空清单、后又用码找回 → 旧空清单孤儿化（无害）。可选：找回时若当前清单为空且仅自己一个成员，顺手删。低优先。
- **同一 Apple ID 多设备**：KVS 同步账号指针 → 各设备自动 claim 同一账号（顺带得到「个人多设备」体验，契合定位）。
- **多账号歧义**：迁移后理论上一个 uid 可能属于多个账号（家庭中两人同在一个清单 → 两个账号都含两人）。`findAccountForUid` 取 `limit 1`，优先匹配 `pointer.activeListId` 所属账号。单清单上架期实际为 1:1，多账号消歧留给多清单时代。
- **`claim_account` 幂等**：已是成员则直接返回账号，不重复追加。

---

## 11. 已知风险（标记，非本次必修）

- **宽 SELECT 策略**：005 的 `"anyone can read list by short_code" USING (auth.uid() IS NOT NULL)` 实际允许任意已登录用户 SELECT 任意 list 行（join 流程所需）。本次沿用；未来可改为仅按精确 `short_code` 命中放行。
- **找回码暴力枚举**：`claim_account` / `join_by_code` 可被枚举。账号码 8 位（≈8500 亿）+ 列表码 6 位（≈8.8 亿），价值有限但建议后续给这两个 RPC 加**调用频率限流**（Edge Function 或 pg 层）。
- **member_uids 无界增长**：每次 wipe+找回追加一个 uid，体量极小；将来可加清理。

---

## 12. 改动文件清单

**新增：**
- `supabase/migrations/009_accounts.sql`（§4、§8）
- `src/lib/durable-store.ts`（抽象 + web no-op + 平台选择）
- `src/lib/account.ts`（`findAccountForUid` / `createAccount` / `claimAccount` / `getOrCreatePrimaryList`）
- `ios` 本地 Capacitor 插件 `KVStore`（Swift + TS 接口）
- `src/lib/active-list.ts`（`persistActiveList` / `clearActiveList`）

**修改：**
- [useAuth.ts](src/hooks/useAuth.ts) / [useList.ts](src/hooks/useList.ts)：新 bootstrap（§7）、冷启动宽限
- [db.ts](src/lib/db.ts)：`getOrCreateList` 纳入 `account_id`；新增账号相关查询
- [JoinByCode.tsx](src/routes/JoinByCode.tsx)：区分「找回」与「加入家人清单」
- [Settings.tsx](src/routes/Settings.tsx)：展示账号找回码 + 文案
- onboarding / 空状态：找回入口 + 一次性卡片

---

## 13. 测试策略

- **Vitest**：
  - `active-list` 镜像逻辑（写 localStorage 同时写 durable；清两边）。
  - bootstrap 解析优先级（mock 假 `DurablePointerStore` + 假 RPC）：
    - 「localStorage 清空 + durable 有指针 → `claim_account` 恢复账号、不建空清单」
    - 「两边都空 → 建账号 + 建首清单」
    - 「URL 邀请覆盖」
    - 「冷启动宽限：load 先空、随后 `didChangeExternally` 带回指针 → 恢复」
- **接口契约**：用 JS fake 验 `DurablePointerStore` 契约（web no-op + 内存假 KVS）。
- **真机手测清单（iOS，找回的真正证明）**：加商品 → 删 App → 重装 → 清单自动回来；换一台同 Apple ID 设备 → 清单出现；设置里关 iCloud → 重装 → 走找回码恢复成功。

---

## 14. 分阶段实施

- **Phase 1（纯 web/TS + SQL，跨平台，无原生，可立即测）**：`009_accounts.sql` 迁移 + 账号/找回模型 + `DurablePointerStore` 抽象（web no-op）+ bootstrap 重排 + 找回码 UX。**这一步本身就跨平台关掉了大部分缺口**（PWA/Android 拿到手动找回码 + 修掉空清单 bug），且 Vitest/PWA 立即可验。
- **Phase 2（iOS 原生）**：`KVStore` 插件 + 接成 iOS `DurablePointerStore` impl + Xcode iCloud capability + 冷启动宽限联调 → iOS 拿到无感自动找回。

两阶段都在 App Store 上架前完成。
