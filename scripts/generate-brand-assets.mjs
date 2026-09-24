// Regenerates favicon, app icons and the Open Graph image from the press-pack
// logo (src/assets/logo.svg) and the studio portrait. Run with:
//   node scripts/generate-brand-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const pub = path.join(root, 'public');
const logoSvg = fs.readFileSync(path.join(root, 'src/assets/logo.svg'), 'utf8');

// --- Favicon: the "K" glyph of the logotype on a black tile -----------------
// The K is the most distinctive single letter (a square with a wedge cut out)
// and is close to square, so it reads well at 16px.
const kMatch = logoSvg.match(/<path id="g-k"[^>]*d="([^"]+)"/);
if (!kMatch) throw new Error('K glyph not found in logo.svg');
const kPath = kMatch[1];
// Glyph bbox inside the logo viewBox (measured when extracting the PDF).
const kBox = { x: 73.70, y: 0.87, w: 20.99, h: 21.18 };
const tile = 64;
const glyphSize = 36;
const scale = glyphSize / Math.max(kBox.w, kBox.h);
const tx = (tile - kBox.w * scale) / 2 - kBox.x * scale;
const ty = (tile - kBox.h * scale) / 2 - kBox.y * scale;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tile} ${tile}">
  <rect width="${tile}" height="${tile}" rx="12" fill="#000"/>
  <path fill="#fff" fill-rule="evenodd" transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})" d="${kPath}"/>
</svg>
`;
fs.writeFileSync(path.join(pub, 'favicon.svg'), favicon);

const faviconBuf = Buffer.from(favicon);
await sharp(faviconBuf, { density: 384 }).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'));
await sharp(faviconBuf, { density: 384 }).resize(192, 192).png().toFile(path.join(pub, 'icon-192.png'));
await sharp(faviconBuf, { density: 384 }).resize(512, 512).png().toFile(path.join(pub, 'icon-512.png'));
const favicon32 = await sharp(faviconBuf, { density: 384 }).resize(32, 32).png().toBuffer();
fs.writeFileSync(path.join(pub, 'favicon-32.png'), favicon32);

// Legacy /favicon.ico for clients that request it blindly: an ICO container
// holding the single 32px PNG (PNG-in-ICO is supported by every modern browser).
const icoHeader = Buffer.alloc(6 + 16);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: icon
icoHeader.writeUInt16LE(1, 4); // image count
icoHeader.writeUInt8(32, 6); // width
icoHeader.writeUInt8(32, 7); // height
icoHeader.writeUInt8(0, 8); // palette
icoHeader.writeUInt8(0, 9); // reserved
icoHeader.writeUInt16LE(1, 10); // color planes
icoHeader.writeUInt16LE(32, 12); // bits per pixel
icoHeader.writeUInt32LE(favicon32.length, 14); // image size
icoHeader.writeUInt32LE(6 + 16, 18); // image offset
fs.writeFileSync(path.join(pub, 'favicon.ico'), Buffer.concat([icoHeader, favicon32]));

// --- Open Graph image: portrait + white logotype -----------------------------
const W = 1200, H = 630;
const portrait = await sharp(path.join(root, 'src/assets/photos/portrait-bw.jpg'))
  .resize(W, H, { fit: 'cover', position: 'top' })
  .modulate({ brightness: 0.9 })
  .toBuffer();

const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.35" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F2880F"/>
      <stop offset="0.5" stop-color="#D6306A"/>
      <stop offset="1" stop-color="#5E2A6E"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <rect width="${W}" height="${H}" fill="url(#h)"/>
  <text x="72" y="372" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="22" font-weight="500" letter-spacing="6" fill="#fff" fill-opacity="0.85">TECHNO · TECH HOUSE · ZLÍN, CZ</text>
  <rect x="72" y="588" width="1056" height="3" fill="url(#brand)"/>
</svg>`);

const logoWhite = Buffer.from(logoSvg.replace('fill="currentColor"', 'fill="#ffffff"'));
const logoPng = await sharp(logoWhite, { density: 600 }).resize({ width: 1056 }).png().toBuffer();
const logoMeta = await sharp(logoPng).metadata();

await sharp(portrait)
  .composite([
    { input: shade, top: 0, left: 0 },
    { input: logoPng, top: 560 - logoMeta.height, left: 72 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(pub, 'og-image.png'));

console.log('brand assets written:', ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.png'].join(', '));
