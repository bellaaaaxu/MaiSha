import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const svgPath = join(root, 'public', 'icon.svg');
const outDir = join(root, 'resources', 'icon');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sizes = [
  // iOS App Store
  { name: 'icon-1024.png', size: 1024 },
  // iPhone @3x
  { name: 'icon-180.png', size: 180 },
  // iPhone @2x
  { name: 'icon-120.png', size: 120 },
  // iPad Pro @2x
  { name: 'icon-167.png', size: 167 },
  // iPad @2x
  { name: 'icon-152.png', size: 152 },
  // iPad @1x
  { name: 'icon-76.png', size: 76 },
  // Spotlight @3x
  { name: 'icon-120-spotlight.png', size: 120 },
  // Spotlight @2x
  { name: 'icon-80.png', size: 80 },
  // Spotlight @1x
  { name: 'icon-40.png', size: 40 },
  // Settings @3x
  { name: 'icon-87.png', size: 87 },
  // Settings @2x
  { name: 'icon-58.png', size: 58 },
  // Settings @1x
  { name: 'icon-29.png', size: 29 },
  // Notification @3x
  { name: 'icon-60.png', size: 60 },
  // Notification @2x
  { name: 'icon-40-notification.png', size: 40 },
  // Notification @1x
  { name: 'icon-20.png', size: 20 },

  // Android
  // Play Store
  { name: 'icon-512.png', size: 512 },
  // xxxhdpi
  { name: 'icon-192.png', size: 192 },
  // xxhdpi
  { name: 'icon-144.png', size: 144 },
  // xhdpi
  { name: 'icon-96.png', size: 96 },
  // hdpi
  { name: 'icon-72.png', size: 72 },
  // mdpi
  { name: 'icon-48.png', size: 48 },

  // PWA
  { name: 'icon-384.png', size: 384 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-128.png', size: 128 },
  { name: 'icon-64.png', size: 64 },
];

console.log(`Generating ${sizes.length} icon sizes from ${svgPath}...`);

for (const { name, size } of sizes) {
  const outPath = join(outDir, name);
  await sharp(svgPath, { density: Math.max(300, size * 2) })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`  ${name} (${size}x${size})`);
}

console.log(`\nDone! Icons saved to resources/icon/`);
console.log('\nNext steps:');
console.log('  iOS:     Copy icon-1024.png to ios/App/App/Assets.xcassets/AppIcon.appiconset/');
console.log('  Android: Copy sized PNGs to android/app/src/main/res/mipmap-*/');
console.log('  PWA:     Reference from vite.config.ts manifest.icons');
