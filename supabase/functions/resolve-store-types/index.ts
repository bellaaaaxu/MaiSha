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

// Same lightweight trad→simp normalization spirit as src/utils/normalize-name.ts.
function normalize(name: string): string {
  return name.trim().replace(/\s+/g, '').slice(0, 40);
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
      .upsert({ name_normalized: key, keywords, source: 'ai' }, { onConflict: 'name_normalized' });
    await service.from('store_type_query_log').insert({ user_uid: user.id, name_normalized: key });

    return jsonResponse({ keywords, source: 'ai' });
  } catch (err) {
    console.error('resolve-store-types error:', err);
    return jsonResponse({ keywords: FALLBACK, source: 'fallback_exception' }, 200);
  }
});
