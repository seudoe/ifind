import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const svgPath = path.join(root, 'public', 'logo-badge.svg');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = [
  { dir: 'mipmap-mdpi', iconSize: 48, fgCanvas: 108, fgIcon: 72 },
  { dir: 'mipmap-hdpi', iconSize: 72, fgCanvas: 162, fgIcon: 108 },
  { dir: 'mipmap-xhdpi', iconSize: 96, fgCanvas: 216, fgIcon: 144 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, fgCanvas: 324, fgIcon: 216 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, fgCanvas: 432, fgIcon: 288 },
];

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Update background color to deep navy matching the badge
  const bgXmlPath = path.join(resDir, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(
    bgXmlPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0f172a</color>\n</resources>\n`
  );
  console.log('Updated ic_launcher_background.xml to #0f172a');

  // 2. Generate icons for each density
  for (const { dir, iconSize, fgCanvas, fgIcon } of DENSITIES) {
    const targetDir = path.join(resDir, dir);
    fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png
    await sharp(svgBuffer)
      .resize(iconSize, iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(svgBuffer)
      .resize(iconSize, iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (centered on transparent canvas)
    const iconBuf = await sharp(svgBuffer)
      .resize(fgIcon, fgIcon)
      .png()
      .toBuffer();

    const offset = Math.round((fgCanvas - fgIcon) / 2);

    await sharp({
      create: {
        width: fgCanvas,
        height: fgCanvas,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: iconBuf, top: offset, left: offset }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons in ${dir} (launcher: ${iconSize}x${iconSize}, fg: ${fgCanvas}x${fgCanvas})`);
  }

  console.log('✅ All Android launcher icons generated successfully from logo-badge.svg');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
