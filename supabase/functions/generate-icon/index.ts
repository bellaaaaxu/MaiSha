// supabase/functions/generate-icon/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const PRE_MATURITY_LIMIT = 2;     // brand-new account, first taste (keeps zero-reg first-use)
const MATURE_DAILY_LIMIT = 5;     // per account/day once mature
const DAILY_GLOBAL_LIMIT = 100;   // cost death-cap
const MATURE_MIN_ITEMS = 3;
const MATURE_MIN_AGE_MS = 60 * 60 * 1000; // 1h
const BUCKET = 'custom-icons';

const PROMPT_WITHOUT_REF = `生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形，无文字无装饰无阴影
- 包装上不要出现任何文字和 logo`;

const PROMPT_WITH_REF = `生成一个手绘素描+柔和上色风格的日用品图标：

物品：{item_name}

风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像高级食谱书的食材插图
- 纯白背景，物体居中，占画面 70-80%
- 256×256 正方形`;

function sanitize(name: string): string {
  return name.trim().slice(0, 30).replace(/[<>{}[\]\\`$]/g, '');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userUid = user.id;

    // 2. Parse body
    const { name, list_id, reference_image } = await req.json();
    if (!name || !list_id) {
      return jsonResponse({ error: 'invalid_input', message: 'name and list_id required' }, 400);
    }
    const sanitizedName = sanitize(name);
    if (!sanitizedName) {
      return jsonResponse({ error: 'invalid_input', message: 'Invalid item name' }, 400);
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(list_id)) {
      return jsonResponse({ error: 'invalid_input', message: 'Invalid list_id' }, 400);
    }

    // 3. Verify user is member of list
    const { data: list } = await supabaseService
      .from('lists')
      .select('id, account_id')
      .eq('id', list_id)
      .contains('member_uids', [userUid])
      .maybeSingle();
    if (!list) {
      return jsonResponse({ error: 'Not a member of this list' }, 403);
    }
    const accountId = list.account_id as string;
    const clientIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || req.headers.get('x-real-ip') || null;

    // 4. Rate limits — per ACCOUNT/day with a graduated maturity gate, plus the global cost cap.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { count: accountCount } = await supabaseService
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('created_at', todayISO);

    // Maturity gate: account age >= 1h OR >= 3 items across the account's lists.
    const { data: acct } = await supabaseService
      .from('accounts').select('created_at').eq('id', accountId).maybeSingle();
    const ageMs = acct?.created_at ? Date.now() - new Date(acct.created_at).getTime() : 0;
    let mature = ageMs >= MATURE_MIN_AGE_MS;
    if (!mature) {
      const { data: acctLists } = await supabaseService
        .from('lists').select('id').eq('account_id', accountId);
      const listIds = (acctLists ?? []).map((l: { id: string }) => l.id);
      if (listIds.length) {
        const { count: itemCount } = await supabaseService
          .from('items').select('*', { count: 'exact', head: true }).in('list_id', listIds);
        mature = (itemCount ?? 0) >= MATURE_MIN_ITEMS;
      }
    }
    const effectiveLimit = mature ? MATURE_DAILY_LIMIT : PRE_MATURITY_LIMIT;

    if ((accountCount ?? 0) >= effectiveLimit) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return jsonResponse({
        error: 'limit_exceeded',
        remaining_today: 0,
        reset_at: tomorrow.toISOString(),
        message: mature ? '今日额度已用完' : '新账号每日先开放 2 次，多加几样东西或稍后即可解锁更多',
      }, 429);
    }

    const { count: globalCount } = await supabaseService
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);
    if ((globalCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return jsonResponse({
        error: 'limit_exceeded', remaining_today: 0, message: '今日总额度已满，请明天再试',
      }, 429);
    }

    // 5. Build prompt and call Gemini Image API
    const promptTemplate = reference_image ? PROMPT_WITH_REF : PROMPT_WITHOUT_REF;
    const prompt = promptTemplate.replace('{item_name}', sanitizedName);

    const parts: Record<string, unknown>[] = [{ text: prompt }];
    if (reference_image) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: reference_image,
        },
      });
    }

    const geminiPayload = {
      contents: [{ parts }],
      generationConfig: {
        // Use IMAGE-only to force image output; with both modalities the model
        // sometimes returns just text (e.g. "好的，请看这张插画" with no image).
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    };

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return jsonResponse({ error: 'generation_failed', message: 'AI generation failed' }, 502);
    }

    const geminiData = await geminiRes.json();
    const responseParts = geminiData.candidates?.[0]?.content?.parts ?? [];
    // The response may have a mix of text and image parts; find the image part.
    // Google APIs may return snake_case (inline_data) or camelCase (inlineData).
    const imagePart = responseParts.find((p: Record<string, any>) =>
      p.inline_data?.data || p.inlineData?.data
    );
    const imageBase64 = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data;
    if (!imageBase64) {
      console.error('No image in Gemini response:', JSON.stringify(geminiData).slice(0, 500));
      return jsonResponse({ error: 'generation_failed', message: 'No image returned' }, 502);
    }

    // 6. Convert base64 to binary
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

    // 7. Upload to Storage
    const iconId = crypto.randomUUID();
    const storagePath = `${accountId}/${iconId}.webp`;

    // Delete old icon file if exists (to avoid orphaned storage)
    const { data: existingIcon } = await supabaseService
      .from('icon_library')
      .select('image_path')
      .eq('account_id', accountId)
      .eq('name', sanitizedName)
      .maybeSingle();

    if (existingIcon) {
      await supabaseService.storage.from(BUCKET).remove([existingIcon.image_path]);
    }

    const { error: uploadErr } = await supabaseService.storage
      .from(BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: 'image/webp',
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    // 8. Upsert icon_library record
    const source = reference_image ? 'ai_stylized' : 'ai_generated';
    const { error: upsertErr } = await supabaseService
      .from('icon_library')
      .upsert(
        { account_id: accountId, name: sanitizedName, image_path: storagePath, source, created_by: userUid },
        { onConflict: 'account_id,name' }
      );
    if (upsertErr) throw upsertErr;

    // 9. Log generation (only on success)
    await supabaseService
      .from('ai_generation_log')
      .insert({ user_uid: userUid, item_name: sanitizedName, account_id: accountId, ip: clientIp });

    // 10. Return public URL
    const { data: urlData } = supabaseService.storage.from(BUCKET).getPublicUrl(storagePath);

    const remaining = effectiveLimit - (accountCount ?? 0) - 1;

    return jsonResponse({
      image_url: urlData.publicUrl,
      remaining_today: Math.max(0, remaining),
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return jsonResponse({ error: 'internal_error', message: (err as Error).message }, 500);
  }
});
