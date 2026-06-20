import sharp from 'sharp';
import { mkdir, copyFile } from 'fs/promises';
import path from 'path';

const SESSION = 'C:\\Users\\Admin\\.grok\\sessions\\C%3A%5CUsers%5CAdmin%5Cgrok-build%5Cracing\\019ea9f7-130b-7473-9fa8-da60638c5e0f\\images';
const DEST = 'C:\\Users\\Admin\\grok-build\\racing\\assets\\backgrounds';

const MAP = [
  ['49.jpg', 'tokyo-neon-night.jpg'],
  ['50.jpg', 'shibuya-sunset.jpg'],
  ['52.jpg', 'fuji-spring.jpg'],
  ['51.jpg', 'kyoto-winter.jpg'],
  ['56.jpg', 'osaka-festival.jpg'],
  ['54.jpg', 'autumn-maple.jpg'],
  ['55.jpg', 'coastal-dawn.jpg'],
  ['53.jpg', 'akihabara-midnight.jpg'],
];

async function makeVerticallySeamless(inputPath, outputPath) {
  const { width: w, height: h } = await sharp(inputPath).metadata();
  const half = Math.floor(h / 2);
  const blend = Math.min(96, Math.max(32, Math.floor(h * 0.05)));

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = info.channels;
  const src = Buffer.from(data);
  const offset = Buffer.alloc(src.length);

  for (let y = 0; y < h; y++) {
    const srcY = (y + half) % h;
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        offset[(y * w + x) * c + ch] = src[(srcY * w + x) * c + ch];
      }
    }
  }

  const result = Buffer.from(offset);
  for (let dy = -blend; dy <= blend; dy++) {
    const y = half + dy;
    if (y < 0 || y >= h) continue;
    const t = 0.5 + dy / (2 * blend);
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        const i = (y * w + x) * c + ch;
        result[i] = Math.round(offset[i] * (1 - t) + src[i] * t);
      }
    }
  }

  await sharp(result, { raw: { width: w, height: h, channels: c } })
    .flatten({ background: '#000000' })
    .jpeg({ quality: 93, mozjpeg: true })
    .toFile(outputPath);
}

await mkdir(path.join(DEST, 'Backups'), { recursive: true });

for (const [srcName, destName] of MAP) {
  const input = path.join(SESSION, srcName);
  const backup = path.join(DEST, 'Backups', destName);
  const existing = path.join(DEST, destName);
  const output = path.join(DEST, destName);

  try {
    await copyFile(existing, backup);
  } catch {
    /* no prior file */
  }

  await makeVerticallySeamless(input, output);
  const meta = await sharp(output).metadata();
  console.log(`OK ${destName} (${meta.width}x${meta.height})`);
}