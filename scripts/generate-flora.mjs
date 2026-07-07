// 梅兰竹菊装饰系批量出图：spec docs/superpowers/specs/2026-07-05-flora-decor-fallback-design.md §1
// 无脸约束 + 风格块一字不改（同一只手）；每只 3 变体落 mascot-staging/flora-generated/。
//
// 用法：node --env-file=.env scripts/generate-flora.mjs [--only song,he] [--variants 3]
// 筛选后定稿存 mascot-staging/flora-final/<id>.png，再跑 compress-flora.mjs 入库。
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'mascot-staging', 'flora-generated');
const MODEL = 'gemini-3-pro-image';
const MAX_RETRIES = 1;

// id 一经上线永不改名（decor-registry 分配依赖）。角色行 = spec §1 剪影特征。
const FLORA = [
  { id: 'mei',      name: '梅',   role: '一枝梅花，深褐色枝干斜出，缀五六朵粉红五瓣梅花和几粒花苞' },
  { id: 'lan',      name: '兰',   role: '一丛兰草，两三片细长弯垂的墨绿叶，开两朵大而清晰的淡紫白色兰花（花朵为主角、叶少而疏）' },
  { id: 'zhu',      name: '竹',   role: '两三竿翠绿竹子，竹节分明，斜出几簇竹叶' },
  { id: 'ju',       name: '菊',   role: '一朵金黄色多层细瓣菊花，微微侧倾，旁衬一片绿叶' },
  { id: 'song',     name: '松',   role: '一枝松枝，深绿针叶成簇，缀一颗棕色松果' },
  { id: 'he',       name: '荷',   role: '一朵粉色荷花大瓣半开，旁边立一只绿色莲蓬' },
  { id: 'gui',      name: '桂',   role: '一枝桂花，米黄色小花簇生在墨绿对叶之间' },
  { id: 'yinxing',  name: '银杏', role: '两三片金黄色扇形银杏叶' },
  { id: 'feng',     name: '枫',   role: '一两片橙红色掌形枫叶' },
  { id: 'shuixian', name: '水仙', role: '一两朵白瓣黄芯的水仙花，配直挺的细长绿叶' },
  { id: 'ziteng',   name: '紫藤', role: '一串淡紫色紫藤花自上垂落' },
  { id: 'luwei',    name: '芦苇', role: '两三支芦苇，棕色绒穗微微弯垂' },
];

const buildPrompt = (role) => `生成一个手绘素描+柔和上色风格的装饰图标：

内容：${role}。
约束：纯植物，没有脸、没有眼睛、没有表情、不拟人；
构图简洁、剪影清晰，缩小到很小尺寸仍一眼可辨。
风格要求：
- 铅笔线稿描边，线条自然有手绘感
- 水彩/彩铅柔和上色，保留笔触和晕染感
- 像手账日记 / 绘本里的可爱角色插画
- 暖米色或纯白背景，角色居中，占画面 70-80%
- 256×256 正方形，无文字无装饰无阴影
- 不要任何文字和 logo`;

async function callModel(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set. Run with: node --env-file=.env scripts/generate-flora.mjs');
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
  const cards = FLORA.map(m => {
    const imgs = files.filter(f => f.startsWith(`${m.id}__`)).map(f => `
      <figure style="margin:0;padding:10px;background:#fff;border-radius:12px">
        <img src="${f}" width="210" style="border-radius:8px;display:block">
        <figcaption style="font-size:12px;margin-top:6px;color:#5a4e3c">${f.match(/__(v\d)/)[1]}</figcaption>
        <div style="margin-top:4px"><img src="${f}" width="44" title="44px 清单"><img src="${f}" width="28" style="margin-left:6px" title="28px 面板"></div>
      </figure>`).join('');
    if (!imgs) return '';
    return `<section style="margin-bottom:26px"><h2 style="color:#5a4e3c;font-size:18px">${m.name} <code style="font-size:12px;color:#a0937e">${m.id}</code></h2><div style="display:flex;gap:14px;flex-wrap:wrap">${imgs}</div></section>`;
  }).join('\n');
  writeFileSync(join(OUT_DIR, 'contact-sheet.html'),
    `<!doctype html><meta charset="utf-8"><title>梅兰竹菊装饰系 contact sheet</title>
     <body style="font-family:sans-serif;background:#faf6ef;padding:24px;max-width:1150px;margin:auto">
     <h1 style="color:#5a4e3c">梅兰竹菊装饰系 · 候选</h1>${cards}</body>`);
}

const args = parseArgs(process.argv);
mkdirSync(OUT_DIR, { recursive: true });
const targets = FLORA.filter(m => !args.only || args.only.includes(m.id));
let ok = 0, fail = 0;
for (const m of targets) {
  for (let v = 1; v <= args.variants; v++) {
    const out = join(OUT_DIR, `${m.id}__v${v}.png`);
    if (existsSync(out)) { console.log(`  skip ${m.id} v${v}`); continue; }
    let done = false;
    for (let attempt = 0; attempt <= MAX_RETRIES && !done; attempt++) {
      try {
        writeFileSync(out, await callModel(buildPrompt(m.role)));
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
console.log(`\ndone: ${ok} ok, ${fail} failed → ${OUT_DIR}\\contact-sheet.html`);
