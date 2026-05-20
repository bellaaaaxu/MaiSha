import sharp from 'sharp';
import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';

const ICONS_DIR = path.resolve('public/icons');
const TARGET_SIZE = 512;
const QUALITY = 85;

async function main() {
  const files = await readdir(ICONS_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));
  console.log(`Found ${pngFiles.length} PNG files to compress`);

  let totalOld = 0;
  let totalNew = 0;

  for (const file of pngFiles) {
    const inputPath = path.join(ICONS_DIR, file);
    const outputPath = path.join(ICONS_DIR, file.replace(/\.png$/, '.webp'));

    const oldStat = await stat(inputPath);
    const oldSize = oldStat.size;

    await sharp(inputPath)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outputPath);

    const newStat = await stat(outputPath);
    const newSize = newStat.size;

    await unlink(inputPath);

    const saved = ((1 - newSize / oldSize) * 100).toFixed(1);
    console.log(`${file}: ${(oldSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (-${saved}%)`);
    totalOld += oldSize;
    totalNew += newSize;
  }

  console.log(`\nTotal: ${(totalOld / 1024 / 1024).toFixed(1)}MB → ${(totalNew / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Saved: ${((1 - totalNew / totalOld) * 100).toFixed(1)}%`);
}

main().catch(err => { console.error(err); process.exit(1); });
