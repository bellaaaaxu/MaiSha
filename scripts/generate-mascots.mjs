// 食物小人班底批量出图：project-design.md §8.5 模板（风格块一字不改，
// 只换角色行 + 定妆约束原样抄入），每只 3 个变体，落 mascot-staging/generated/。
//
// 用法：node --env-file=.env scripts/generate-mascots.mjs [--only jiaozi,danta] [--variants 3]
// 产出后人工/Claude 过 contact-sheet.html 筛选，中选者存 mascot-staging/final/<id>.png
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'mascot-staging', 'generated');
const MODEL = 'gemini-3-pro-image';
const MAX_RETRIES = 1;

// 角色行特征：剪影 + 颜色彼此分得开（§8.5 判定：缩到 44px 一眼能区分）
const MASCOTS = [
  { id: 'jiaozi',        role: '一只卡通饺子，白白胖胖的元宝形，弯月剪影、面皮褶边清晰' },
  { id: 'tanghulu',      role: '一串卡通糖葫芦，红亮糖球串在竹签上，竖直一串、糖衣光泽（脸在最上面那颗糖球上）' },
  { id: 'jianbingguozi', role: '一只卡通煎饼果子，金黄软饼对折、边缘微翘，露出薄脆一角' },
  { id: 'chayedan',      role: '一只卡通茶叶蛋，棕褐色茶卤蛋，蛋壳裂纹大理石纹路' },
  { id: 'danta',         role: '一只卡通蛋挞，金黄嫩滑蛋心带焦糖斑点，酥皮花边小盅' },
  { id: 'boluobao',      role: '一只卡通菠萝包，金黄圆面包，顶面烤出菠萝格纹' },
  { id: 'xiajiao',       role: '一只卡通虾饺，半透明粉白水晶皮，弯梳形褶皱、隐约透出虾的粉色' },
  { id: 'jidanzai',      role: '一块卡通鸡蛋仔，蛋黄色蜂窝泡泡华夫，一颗颗圆泡鼓起（脸在中间的圆泡上）' },
  { id: 'zhenzhunaicha', role: '一杯卡通珍珠奶茶，奶茶色透明杯、杯底沉着黑珍珠、插一根粗吸管（脸在杯身上）' },
  { id: 'fenglisu',      role: '一块卡通凤梨酥，金黄小方块酥，四角圆润、表面微微烤色' },
];

// §8.5：定妆约束原样抄进角色行；风格要求块一字不改（队长 prompt 同款）
const buildPrompt = (role) => `生成一个手绘素描+柔和上色风格的吉祥物图标：

角色：${role}。
定妆：圆豆眼 + 单高光、一道弧形微笑、两坨腮红；只有食物本体和脸，
没有手脚四肢、不拿任何道具、没有鼻子、没有耳朵。
治愈、呆萌、招人疼
风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像手账日记 / 绘本里的可爱角色插画
- 暖米色或纯白背景，角色居中，占画面 70-80%
- 256×256 正方形，无文字无装饰无阴影
- 不要任何文字和 logo`;

async function callModel(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set. Run with: node --env-file=.env scripts/generate-mascots.mjs');
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;
  const res = await fetch(`${base}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const part = parts.find(p => p.inline_data?.data || p.inlineData?.data);
  const b64 = part?.inline_data?.data ?? part?.inlineData?.data;
  if (!b64) throw new Error('No image in Gemini response');
  return Buffer.from(b64, 'base64');
}

function parseArgs(argv) {
  const args = { only: null, variants: 3 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--only') args.only = argv[++i].split(',');
    else if (argv[i] === '--variants') args.variants = Number(argv[++i]);
  }
  return args;
}

function writeContactSheet() {
  const files = readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  const cards = MASCOTS.map(m => {
    const variants = files.filter(f => f.startsWith(`${m.id}__`));
    const imgs = variants.map(f =>
      `<figure><img src="${f}" width="220"><figcaption>${f}</figcaption>
       <img src="${f}" width="44" style="margin-left:8px;vertical-align:bottom" title="44px 实际尺寸"></figure>`
    ).join('');
    return `<section><h2>${m.id}</h2><div style="display:flex;gap:12px;flex-wrap:wrap">${imgs}</div></section>`;
  }).join('\n');
  writeFileSync(join(OUT_DIR, 'contact-sheet.html'),
    `<!doctype html><meta charset="utf-8"><title>班底 contact sheet</title>
     <body style="font-family:sans-serif;background:#faf6ef;padding:20px">${cards}</body>`);
}

const args = parseArgs(process.argv);
mkdirSync(OUT_DIR, { recursive: true });
const targets = MASCOTS.filter(m => !args.only || args.only.includes(m.id));
let ok = 0, fail = 0;
for (const m of targets) {
  for (let v = 1; v <= args.variants; v++) {
    const out = join(OUT_DIR, `${m.id}__v${v}.png`);
    if (existsSync(out)) { console.log(`  skip ${m.id} v${v} (exists)`); continue; }
    let done = false;
    for (let attempt = 0; attempt <= MAX_RETRIES && !done; attempt++) {
      try {
        const png = await callModel(buildPrompt(m.role));
        writeFileSync(out, png);
        console.log(`  ✓ ${m.id} v${v}`);
        ok++; done = true;
      } catch (err) {
        if (attempt < MAX_RETRIES) console.log(`    retry ${m.id} v${v} (${err.message})`);
        else { console.log(`  ✗ ${m.id} v${v} — ${err.message}`); fail++; }
      }
    }
  }
}
writeContactSheet();
console.log(`\ndone: ${ok} generated, ${fail} failed → ${OUT_DIR}\\contact-sheet.html`);
