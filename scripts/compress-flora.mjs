// 梅兰竹菊装饰系压缩：mascot-staging/flora-final/<id>.png → public/flora/<id>.webp
// 用法：node scripts/compress-flora.mjs
//
// 复用 compress-ui-icons.mjs 的边缘 flood-fill 思路：只抠与画布边界连通的
// 背景（白/暖米色），线稿包住的内部留白（饺子白胖身体、虾饺水晶皮高光）
// 全保留。显示 48px，256 覆盖到 85px@3x。
import sharp from 'sharp';
import { mkdir, stat, readdir } from 'fs/promises';
import { existsSync } from 'node:fs';

const FINAL_DIR = 'mascot-staging/flora-final';
const OUT_DIR = 'public/flora';
const CAPTAIN = null; // 装饰系无队长
const SIZE = 256;
const QUALITY = 80;

// 背景判定不能用固定阈值：§8.5 允许「暖米色或纯白背景」，实际出图底色
// 从纯白到茶色不等。改为取样边缘 2px 环的平均色作底色参照，容差内视为
// 背景；只在边缘 flood-fill 中使用，误伤仅限与边界连通的区域。
const TOLERANCE = 20;

async function stripOuterBg(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let sr = 0, sg = 0, sb = 0, n = 0;
  const sample = (x, y) => {
    const p = (y * W + x) * C;
    sr += data[p]; sg += data[p + 1]; sb += data[p + 2]; n++;
  };
  for (let x = 0; x < W; x++) { sample(x, 0); sample(x, 1); sample(x, H - 2); sample(x, H - 1); }
  for (let y = 0; y < H; y++) { sample(0, y); sample(1, y); sample(W - 2, y); sample(W - 1, y); }
  const br = sr / n, bgc = sg / n, bb = sb / n;
  const isBg = (r, g, b) =>
    Math.abs(r - br) <= TOLERANCE && Math.abs(g - bgc) <= TOLERANCE && Math.abs(b - bb) <= TOLERANCE;
  const bg = new Uint8Array(W * H);
  const qx = new Int32Array(W * H);
  const qy = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  const push = (x, y) => {
    const i = y * W + x;
    if (bg[i]) return;
    const p = i * C;
    if (!isBg(data[p], data[p + 1], data[p + 2])) return;
    bg[i] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail++;
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head++;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) data[i * C + 3] = 0;
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } });
}

await mkdir(OUT_DIR, { recursive: true });
const jobs = [];
if (existsSync(FINAL_DIR)) {
  for (const f of (await readdir(FINAL_DIR)).filter(f => f.endsWith('.png'))) {
    jobs.push([`${FINAL_DIR}/${f}`, `${OUT_DIR}/${f.replace(/\.png$/, '.webp')}`]);
  }
}


let total = 0;
for (const [src, out] of jobs) {
  const img = await stripOuterBg(src);
  await img.resize(SIZE, SIZE, { fit: 'inside' }).webp({ quality: QUALITY }).toFile(out);
  const oldKB = (await stat(src)).size / 1024;
  const newKB = (await stat(out)).size / 1024;
  total += newKB;
  console.log(`${src} → ${out}  ${oldKB.toFixed(0)}KB → ${newKB.toFixed(1)}KB`);
}
console.log(`\n${jobs.length} 张，共 ${total.toFixed(0)}KB（precache 预算内应 ≤400KB）`);
