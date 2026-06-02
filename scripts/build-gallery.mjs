// scripts/build-gallery.mjs
//
// Build a clean gallery of the icons that actually ship: every preset registered
// in icon-registry.ts, grouped by category, pointing at its public/icons webp.
// This is "what shows up in 买啥 after commit+push" — not the messy staging sheet.
//
//   node scripts/build-gallery.mjs   →  writes icon-gallery.html (open in browser)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reg = readFileSync(join(ROOT, 'src', 'utils', 'icon-registry.ts'), 'utf8');

const RE = /\{\s*name:\s*'([^']+)',\s*icon:\s*'([a-z0-9-]+)',\s*category:\s*'([^']+)'/g;
const items = [];
let m;
while ((m = RE.exec(reg))) items.push({ name: m[1], icon: m[2], category: m[3] });

const byCat = {};
for (const it of items) (byCat[it.category] ??= []).push(it);

const missing = items.filter(it => !existsSync(join(ROOT, 'public', 'icons', `${it.icon}.webp`)));

const sections = Object.keys(byCat).map(cat => {
  const cells = byCat[cat].map(it => {
    const has = existsSync(join(ROOT, 'public', 'icons', `${it.icon}.webp`));
    return `<figure${has ? '' : ' class="missing"'}><div class="box"><img src="public/icons/${it.icon}.webp" alt="${it.name}"/></div><figcaption>${it.name}</figcaption></figure>`;
  }).join('');
  return `<section><h2>${cat} · ${byCat[cat].length}</h2><div class="grid">${cells}</div></section>`;
}).join('\n');

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"/>
<title>买啥 · 预设图标 (${items.length})</title>
<style>
  body{margin:0;padding:24px;background:linear-gradient(180deg,#faf6f0,#f3ede4);font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#5a4e3c}
  h1{font-size:18px;margin:0 0 4px}
  .sub{font-size:12px;color:#a0937e;margin:0 0 20px}
  section{margin-bottom:22px}
  h2{font-size:13px;color:#7a6e5d;border-left:4px solid #7ca982;padding-left:8px;margin:0 0 12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}
  figure{margin:0;text-align:center}
  .box{aspect-ratio:1;background:#fff;border:1px solid rgba(215,205,188,.4);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .box img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
  figcaption{font-size:11px;color:#5a4e3c;margin-top:5px}
  figure.missing .box{border:1px dashed #c97b63;background:#fff5f2}
  figure.missing figcaption{color:#c97b63}
</style></head><body>
<h1>买啥 · 会上架的预设图标</h1>
<p class="sub">${items.length} 个已注册预设，按分类。${missing.length ? `红色虚线 = 注册了但缺图（${missing.length} 个）。` : '全部有图。'}</p>
${sections}
</body></html>`;

writeFileSync(join(ROOT, 'icon-gallery.html'), html);
console.log(`Gallery: ${items.length} registered icons, ${Object.keys(byCat).length} categories → icon-gallery.html`);
if (missing.length) console.log(`⚠ registered but missing webp (${missing.length}): ${missing.map(i => i.icon).join(', ')}`);
