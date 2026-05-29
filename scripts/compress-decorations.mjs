import sharp from 'sharp';
import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';

// Decorative assets (washi tapes, etc.) — long-strip aspect ratios, watercolor
// textures with alpha. Sized for ~240px display × 3x retina + headroom.
// See memory/project_asset_optimization_rule.md.

const DECORATIONS_DIR = path.resolve('public/decorations');
const MAX_LONGEST_SIDE = 1200;
const QUALITY = 85;
const ALPHA_QUALITY = 90;

async function main() {
  const files = await readdir(DECORATIONS_DIR);
  const pngFiles = files.filter(f => f.endsWith('.png'));
  if (pngFiles.length === 0) {
    console.log('No PNG files in public/decorations/ — nothing to compress.');
    return;
  }
  console.log(`Found ${pngFiles.length} PNG files to compress`);

  let totalOld = 0;
  let totalNew = 0;

  for (const file of pngFiles) {
    const inputPath = path.join(DECORATIONS_DIR, file);
    const outputPath = path.join(DECORATIONS_DIR, file.replace(/\.png$/, '.webp'));

    const oldStat = await stat(inputPath);
    const oldSize = oldStat.size;

    // Resize so longest side is at most MAX_LONGEST_SIDE; preserve aspect ratio
    // by passing null for the other dimension.
    await sharp(inputPath)
      .resize(MAX_LONGEST_SIDE, MAX_LONGEST_SIDE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY })
      .toFile(outputPath);

    const newStat = await stat(outputPath);
    const newSize = newStat.size;

    await unlink(inputPath);

    const saved = ((1 - newSize / oldSize) * 100).toFixed(1);
    console.log(
      `${file}: ${(oldSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (-${saved}%)`
    );
    totalOld += oldSize;
    totalNew += newSize;
  }

  console.log(
    `\nTotal: ${(totalOld / 1024 / 1024).toFixed(1)}MB → ${(totalNew / 1024 / 1024).toFixed(1)}MB`
  );
  console.log(`Saved: ${((1 - totalNew / totalOld) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
