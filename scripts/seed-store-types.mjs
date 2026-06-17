// scripts/seed-store-types.mjs
//
// Offline one-time seed: preset item names → store_type_hints (source='seed').
//
// Required env vars (set in .env or export before running):
//   GEMINI_API_KEY           — Gemini API key
//   SUPABASE_URL             — project REST URL (e.g. https://xxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY — service-role key (bypasses RLS; keep secret)
//
// Usage:
//   node --env-file=.env scripts/seed-store-types.mjs
//
// The script is resumable: rows already present in store_type_hints are skipped.
//
// Data source: mirrors generate-item-icons.mjs — reads item names from
//   scripts/data/item-catalog.mjs  (186 bulk items, plain JS)
//   icon-prompts.md                (91 hand-tuned items, parsed by scripts/lib/parse-icon-prompts.mjs)
// deduped by stem, same as the icon-generation pipeline (the proven mechanism).
// This avoids the fragile --experimental-strip-types approach of importing the TS file.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIconPrompts } from './lib/parse-icon-prompts.mjs';
import catalog from './data/item-catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PROMPT = `你是购物助手。用户想买一件商品，告诉我哪些"店类型"最可能卖它。
商品：{item}
返回一个 JSON 数组，每项 {"term": 店类型搜索词, "tier": 1|2|3}（tier1最专门，tier3兜底通用），
中英文都要，6~8 项按 tier 升序。只返回 JSON 数组。`;

// Trad→simp folding table. MUST stay byte-identical to src/utils/normalize-name.ts.
// If you add entries there, add them here and in supabase/functions/resolve-store-types/index.ts too.
const TRAD_TO_SIMP = {
  '醬': '酱', '漿': '浆', '鹽': '盐',
  '雞': '鸡', '鴨': '鸭', '鵝': '鹅', '魚': '鱼', '蝦': '虾', '蠔': '蚝',
  '鱈': '鳕', '鮭': '鲑', '鮮': '鲜', '鱸': '鲈', '鯽': '鲫',
  '豬': '猪', '醃': '腌', '滷': '卤', '燉': '炖',
  '蘿': '萝', '蔔': '卜', '蔥': '葱', '薑': '姜',
  '麵': '面', '飯': '饭', '餅': '饼', '餃': '饺', '麥': '麦', '饅': '馒',
  '蘋': '苹', '檸': '柠', '蕎': '荞', '蘆': '芦', '薺': '荠',
  '鵪': '鹌', '鶉': '鹑', '黃': '黄', '蓮': '莲', '筍': '笋',
  '凍': '冻', '糰': '团', '餛': '馄', '飩': '饨', '腸': '肠',
};

// normalize: trim, collapse whitespace, fold trad→simp, truncate to 40 chars.
// Ensures zh-TW and zh-CN queries for the same item share one cache key.
const normalize = (s) => {
  const stripped = s.trim().replace(/\s+/g, '');
  let out = '';
  for (const ch of stripped) out += TRAD_TO_SIMP[ch] ?? ch;
  return out.slice(0, 40);
};

// Load items from both sources, deduped by stem (same logic as generate-item-icons.mjs).
function loadAllItems() {
  const md = parseIconPrompts(readFileSync(resolve(ROOT, 'icon-prompts.md'), 'utf8'));
  const seen = new Set(md.map((i) => i.stem));
  const fromCatalog = catalog.filter((c) => !seen.has(c.stem));
  return [...md, ...fromCatalog];
}

// parseKeywords: parse + validate + clamp Gemini output into a safe keyword array.
// MUST stay in sync with the parseKeywords copy in supabase/functions/resolve-store-types/index.ts —
// both writers share the same store_type_hints table, so the output shape must match.
function parseKeywords(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((k) => k && typeof k.term === 'string' && Number.isFinite(k.tier))
      .map((k) => ({ term: String(k.term).slice(0, 40), tier: Math.min(3, Math.max(1, k.tier)) }));
  } catch {
    return [];
  }
}

async function resolveViaGemini(name) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace('{item}', name) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return parseKeywords(text);
}

async function main() {
  const items = loadAllItems();
  // Dedupe by name (some items with different stems may share a Chinese name after normalize)
  const names = [...new Set(items.map((i) => i.name))];
  console.log(`Seeding ${names.length} preset item names into store_type_hints…`);

  let done = 0;
  for (const name of names) {
    const key = normalize(name);

    // Resumable: skip rows already present
    const { data: hit } = await supabase
      .from('store_type_hints')
      .select('id')
      .eq('name_normalized', key)
      .maybeSingle();
    if (hit) {
      done++;
      if (done % 50 === 0) console.log(`  skipped ${done}/${names.length} (already seeded)`);
      continue;
    }

    try {
      const keywords = await resolveViaGemini(name);
      if (keywords.length) {
        const { error } = await supabase
          .from('store_type_hints')
          .upsert({ name_normalized: key, keywords, source: 'seed', updated_at: new Date().toISOString() }, { onConflict: 'name_normalized' });
        if (error) console.error(`  DB error for "${name}":`, error.message);
      } else {
        console.warn(`  empty keywords for "${name}", skipping`);
      }
    } catch (e) {
      console.error(`  skip "${name}": ${e.message}`);
    }

    done++;
    console.log(`${done}/${names.length}  ${name}`);

    // Brief pause to avoid hammering the Gemini rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('seed complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
