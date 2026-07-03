// 头部 UI 小图标压缩：mascot-staging/*.png → public/ui/*.webp
// 用法：node scripts/compress-ui-icons.mjs
import sharp from 'sharp';
import { mkdir, stat } from 'fs/promises';

// boost = multiply 自叠加次数：浅色水彩在 22px 会与暖粉按钮底融掉，
// 自乘可按比例加深中间调（近白处几乎不动），保留水彩质感
const JOBS = [
  ['mascot-staging/ListSwitcherIcon.png', 'public/ui/list-switcher.webp', { boost: 0 }],
  ['mascot-staging/PaperPlaneIcon.png', 'public/ui/paper-plane.webp', { boost: 0 }],
  ['mascot-staging/RefreshIcon.png', 'public/ui/refresh.webp', { boost: 0 }],
];
const SIZE = 128;   // 显示 22px（头部按钮），128 覆盖到未来 44px@2x
const QUALITY = 85;

const isBg = (r, g, b) => r >= 248 && g >= 246 && b >= 242;

// 从画布边缘 flood-fill 抠掉"与边界连通的白底"——只抠外部背景。
// 不能用全局白转透明：纸飞机米白机身(255,249,235)、留白高光都近白，
// 但它们被线稿包住、与边界不连通，因此得以保留；刷新环中心洞经缺口
// 连通外部，正确变透明。
async function stripOuterWhite(input) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
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

await mkdir('public/ui', { recursive: true });
for (const [src, out, opts] of JOBS) {
  const stripped = await (await stripOuterWhite(src)).png().toBuffer();
  let buf = stripped;
  for (let i = 0; i < (opts?.boost ?? 0); i++) {
    buf = await sharp(buf)
      .composite([{ input: buf, blend: 'multiply' }])
      .png()
      .toBuffer();
  }
  let img = sharp(buf);
  if (opts?.boost) img = img.modulate({ saturation: 1.3 });
  await img.resize(SIZE, SIZE, { fit: 'inside' }).webp({ quality: QUALITY }).toFile(out);
  const oldKB = (await stat(src)).size / 1024;
  const newKB = (await stat(out)).size / 1024;
  console.log(`${src} → ${out}  ${oldKB.toFixed(0)}KB → ${newKB.toFixed(1)}KB  boost=${opts?.boost ?? 0}`);
}
