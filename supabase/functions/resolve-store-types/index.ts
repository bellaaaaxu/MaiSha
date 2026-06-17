// supabase/functions/resolve-store-types/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const DAILY_GLOBAL_LIMIT = 100; // cost backstop; rarely hit thanks to the cache
const FALLBACK: Keyword[] = [
  { term: '超市', tier: 3 },
  { term: 'supermarket', tier: 3 },
];

interface Keyword { term: string; tier: number }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Trad→simp folding table. MUST stay byte-identical to src/utils/normalize-name.ts.
// If you add entries there, add them here and in scripts/seed-store-types.mjs too.
const TRAD_TO_SIMP: Record<string, string> = {
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
function normalize(name: string): string {
  const stripped = name.trim().replace(/\s+/g, '');
  let out = '';
  for (const ch of stripped) out += TRAD_TO_SIMP[ch] ?? ch;
  return out.slice(0, 40);
}

const PROMPT = `你是购物助手。用户想买一件商品，告诉我哪些"店类型"最可能卖它。
商品：{item}
返回一个 JSON 数组，每项 {"term": 店类型搜索词, "tier": 1|2|3}：
- tier 1 = 最专门最可能（如"日系超市"）
- tier 2 = 较可能的大类（如"亚洲超市""进口食品店"）
- tier 3 = 兜底通用（如"超市"）
- 中英文搜索词都要给（覆盖中国大城市与北美华人区）
- 6~8 项，按 tier 升序
只返回 JSON 数组本身，不要其它文字。`;

// parseKeywords: parse + validate + clamp Gemini output into a safe Keyword[].
// MUST stay in sync with the parseKeywords copy in scripts/seed-store-types.mjs —
// both writers share the same store_type_hints table, so the output shape must match.
function parseKeywords(text: string): Keyword[] {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await anon.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return jsonResponse({ error: 'invalid_input', message: 'name required' }, 400);
    }
    const key = normalize(name);
    if (!key) return jsonResponse({ error: 'invalid_input' }, 400);

    // 1. Cache hit → free
    const { data: cached } = await service
      .from('store_type_hints').select('keywords').eq('name_normalized', key).maybeSingle();
    if (cached) return jsonResponse({ keywords: cached.keywords, source: 'cache' });

    // 2. Global daily backstop → degrade to generic, don't hard-fail
    // count-then-insert is intentionally non-atomic; the 100/day cap is an approximate
    // soft backstop — cache hits make real misses rare, so races don't matter here.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count } = await service
      .from('store_type_query_log').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    if ((count ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return jsonResponse({ keywords: FALLBACK, source: 'fallback_limit' });
    }

    // 3. Gemini text call (JSON mode)
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace('{item}', key) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      console.error('Gemini error:', await res.text());
      return jsonResponse({ keywords: FALLBACK, source: 'fallback_error' });
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const keywords = parseKeywords(text);
    if (!keywords.length) return jsonResponse({ keywords: FALLBACK, source: 'fallback_parse' });

    // 4. Persist to shared cache + counter (best-effort; ignore write races)
    await service.from('store_type_hints')
      .upsert({ name_normalized: key, keywords, source: 'ai', updated_at: new Date().toISOString() }, { onConflict: 'name_normalized' });
    await service.from('store_type_query_log').insert({ user_uid: user.id, name_normalized: key });

    return jsonResponse({ keywords, source: 'ai' });
  } catch (err) {
    console.error('resolve-store-types error:', err);
    return jsonResponse({ keywords: FALLBACK, source: 'fallback_exception' }, 200);
  }
});
