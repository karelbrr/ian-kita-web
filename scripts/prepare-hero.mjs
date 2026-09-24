// Builds src/assets/hero-stage-clean.jpg from the Mácháč 2026 stage photo:
//   1. crops the bottom strip that carries the festival watermark;
//   2. removes the small logotype displayed on the LED wall by filling its thin
//      white strokes from the surrounding mosaic (PatchMatch inpainting), so the
//      site's own logotype is the only one in the hero.
// Run with: node scripts/prepare-hero.mjs [--preview]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const source = path.join(root, 'src/assets/photos/machac-2026-stage.jpg');
const target = path.join(root, 'src/assets/hero-stage-clean.jpg');
const preview = process.argv.includes('--preview');

const CROP_BOTTOM = 120;
// Box around the wall logotype, in cropped-image coordinates.
const BOX = { left: 838, top: 358, width: 382, height: 78 };
const MARGIN = 24;
const MIN_COMPONENT = 40; // px — drops stray highlight pixels
const DILATE = 3;

const meta = await sharp(source).metadata();
const W = meta.width;
const H = meta.height - CROP_BOTTOM;
const cropped = sharp(source).extract({ left: 0, top: 0, width: W, height: H });

// Working window = logo box + margin, as raw RGB.
const win = {
  left: BOX.left - MARGIN,
  top: BOX.top - MARGIN,
  width: BOX.width + 2 * MARGIN,
  height: BOX.height + 2 * MARGIN,
};
const { data, info } = await cropped.clone().extract(win).raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;

// 1. Threshold near-white pixels inside the logo box only.
const hit = new Uint8Array(w * h);
for (let y = MARGIN; y < h - MARGIN; y++) {
  for (let x = MARGIN; x < w - MARGIN; x++) {
    const i = (y * w + x) * 3;
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 195) hit[y * w + x] = 1;
  }
}

// 2. Keep only sizeable connected components (the letter strokes).
const label = new Int32Array(w * h).fill(-1);
const keep = new Uint8Array(w * h);
let comp = 0;
for (let s = 0; s < w * h; s++) {
  if (!hit[s] || label[s] !== -1) continue;
  const stack = [s]; const members = []; label[s] = comp;
  while (stack.length) {
    const p = stack.pop(); members.push(p);
    const px = p % w, py = (p - px) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = px + dx, ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (hit[q] && label[q] === -1) { label[q] = comp; stack.push(q); }
    }
  }
  if (members.length >= MIN_COMPONENT) for (const p of members) keep[p] = 1;
  comp++;
}

// 3. Dilate the strokes to swallow anti-aliased edges. Only the strokes are
//    treated as holes: the mosaic cells between the letters are real and stay.
const mask = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (!keep[y * w + x]) continue;
  for (let dy = -DILATE; dy <= DILATE; dy++) for (let dx = -DILATE; dx <= DILATE; dx++) {
    if (dx * dx + dy * dy > DILATE * DILATE) continue;
    const yy = y + dy, xx = x + dx;
    if (yy >= 0 && xx >= 0 && yy < h && xx < w) mask[yy * w + xx] = 1;
  }
}

// 4. Multi-scale PatchMatch inpainting with patch voting (Wexler et al. /
//    Barnes et al., the approach behind "content-aware fill"): the hole is
//    first filled coarsely, then at each scale every patch overlapping the
//    hole is matched to the most similar hole-free patch nearby and hole
//    pixels are re-estimated as a weighted vote of all matched patches.
//    Repeating this converges to coherent texture — cells and grout lines
//    continue naturally instead of smearing or fragmenting.
const PR = 3;                       // patch radius → 7×7 patches
const LEVELS = 3;                   // 1/4, 1/2, 1/1 scale
const EM_ITER = [10, 12, 16];       // voting rounds per level (coarse → fine)
const PM_ITER = 5;                  // PatchMatch sweeps per round
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// Pyramid of (image, mask). Downsample 2× with box filter over known pixels.
const levels = [];
{
  let img = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) img[i] = data[i];
  let m = Uint8Array.from(mask), lw = w, lh = h;
  levels.push({ img, mask: m, w: lw, h: lh });
  for (let l = 1; l < LEVELS; l++) {
    const nw = Math.floor(lw / 2), nh = Math.floor(lh / 2);
    const nimg = new Float32Array(nw * nh * 3), nm = new Uint8Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, n = 0, holes = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sp = (y * 2 + dy) * lw + (x * 2 + dx);
        if (m[sp]) { holes++; continue; }
        r += img[sp * 3]; g += img[sp * 3 + 1]; b += img[sp * 3 + 2]; n++;
      }
      const t = y * nw + x;
      if (n === 0) { nm[t] = 1; } else { nimg[t * 3] = r / n; nimg[t * 3 + 1] = g / n; nimg[t * 3 + 2] = b / n; if (holes >= 2) nm[t] = 1; }
    }
    levels.push({ img: nimg, mask: nm, w: nw, h: nh });
    img = nimg; m = nm; lw = nw; lh = nh;
  }
}

// Coarsest level: initialise holes by diffusion.
{
  const L = levels[LEVELS - 1]; const { img, mask: m, w: lw, h: lh } = L;
  for (let i = 0; i < lw * lh; i++) if (m[i]) { img[i * 3] = 128; img[i * 3 + 1] = 64; img[i * 3 + 2] = 96; }
  for (let it = 0; it < 600; it++) {
    for (let y = 1; y < lh - 1; y++) for (let x = 1; x < lw - 1; x++) {
      const p = y * lw + x; if (!m[p]) continue;
      for (let c = 0; c < 3; c++) { const i = p * 3 + c; img[i] = 0.25 * (img[i - 3] + img[i + 3] + img[i - lw * 3] + img[i + lw * 3]); }
    }
  }
}

for (let l = LEVELS - 1; l >= 0; l--) {
  const { img, mask: m, w: lw, h: lh } = levels[l];
  if (l < LEVELS - 1) {
    // Initialise this level's holes from the coarser result (bilinear).
    const C = levels[l + 1];
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const p = y * lw + x; if (!m[p]) continue;
      const fx = Math.min(C.w - 1.001, Math.max(0, (x + 0.5) / 2 - 0.5)), fy = Math.min(C.h - 1.001, Math.max(0, (y + 0.5) / 2 - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      for (let c = 0; c < 3; c++) {
        const v00 = C.img[(y0 * C.w + x0) * 3 + c], v10 = C.img[(y0 * C.w + x0 + 1) * 3 + c], v01 = C.img[((y0 + 1) * C.w + x0) * 3 + c], v11 = C.img[((y0 + 1) * C.w + x0 + 1) * 3 + c];
        img[p * 3 + c] = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
      }
    }
  }
  // Integral image of the hole mask → "patch is hole-free" test.
  const integ = new Int32Array((lw + 1) * (lh + 1));
  for (let y = 1; y <= lh; y++) for (let x = 1; x <= lw; x++) integ[y * (lw + 1) + x] = m[(y - 1) * lw + (x - 1)] + integ[(y - 1) * (lw + 1) + x] + integ[y * (lw + 1) + (x - 1)] - integ[(y - 1) * (lw + 1) + (x - 1)];
  const holeCount = (x0, y0, x1, y1) => integ[(y1 + 1) * (lw + 1) + (x1 + 1)] - integ[y0 * (lw + 1) + (x1 + 1)] - integ[(y1 + 1) * (lw + 1) + x0] + integ[y0 * (lw + 1) + x0];
  const validSrc = (qx, qy) => qx >= PR && qy >= PR && qx < lw - PR && qy < lh - PR && holeCount(qx - PR, qy - PR, qx + PR, qy + PR) === 0;
  // Target patch centres: within PR of a hole and fully inside the image.
  const targets = [];
  for (let y = PR; y < lh - PR; y++) for (let x = PR; x < lw - PR; x++) if (holeCount(x - PR, y - PR, x + PR, y + PR) > 0) targets.push(y * lw + x);
  const srcList = [];
  for (let y = PR; y < lh - PR; y++) for (let x = PR; x < lw - PR; x++) if (validSrc(x, y)) srcList.push(y * lw + x);
  const ssd = (p, q, cap) => {
    const px0 = p % lw, py0 = (p - px0) / lw, qx0 = q % lw, qy0 = (q - qx0) / lw; let d = 0;
    for (let dy = -PR; dy <= PR; dy++) {
      let ti = ((py0 + dy) * lw + px0 - PR) * 3, si = ((qy0 + dy) * lw + qx0 - PR) * 3;
      for (let dx = -PR; dx <= PR; dx++) { const a = img[ti] - img[si], b = img[ti + 1] - img[si + 1], c = img[ti + 2] - img[si + 2]; d += a * a + b * b + c * c; ti += 3; si += 3; }
      if (d >= cap) return d;
    }
    return d;
  };
  const nn = new Int32Array(targets.length), nd = new Float32Array(targets.length);
  const tIndex = new Int32Array(lw * lh).fill(-1);
  targets.forEach((p, i) => { tIndex[p] = i; });
  for (let i = 0; i < targets.length; i++) { nn[i] = srcList[Math.floor(rand() * srcList.length)]; nd[i] = ssd(targets[i], nn[i], Infinity); }
  const maxR = Math.max(lw, lh);
  for (let em = 0; em < EM_ITER[LEVELS - 1 - l]; em++) {
    for (let it = 0; it < PM_ITER; it++) {
      const forward = it % 2 === 0;
      for (let k = 0; k < targets.length; k++) {
        const i = forward ? k : targets.length - 1 - k; const p = targets[i]; const px0 = p % lw, py0 = (p - px0) / lw;
        const tryQ = (qx, qy) => { if (!validSrc(qx, qy)) return; const q = qy * lw + qx; const d = ssd(p, q, nd[i]); if (d < nd[i]) { nd[i] = d; nn[i] = q; } };
        // propagation from already-visited neighbours
        for (const [dx, dy] of forward ? [[-1, 0], [0, -1]] : [[1, 0], [0, 1]]) {
          const np = (py0 + dy) * lw + px0 + dx; const j = tIndex[np]; if (j < 0) continue;
          const q = nn[j]; const qx = q % lw, qy = (q - qx) / lw; tryQ(qx - dx, qy - dy);
        }
        // random search around the current best
        const cx = nn[i] % lw, cy = (nn[i] - cx) / lw;
        for (let rad = maxR; rad >= 1; rad = Math.floor(rad / 2)) {
          tryQ(cx + Math.round((rand() * 2 - 1) * rad), cy + Math.round((rand() * 2 - 1) * rad));
        }
      }
    }
    // Voting: hole pixels ← similarity-weighted mean over all covering patches.
    let meanD = 0; for (let i = 0; i < targets.length; i++) meanD += nd[i]; meanD /= targets.length || 1;
    const sigma2 = Math.max(meanD * 0.35, 1); // fairly sharp voting: poor matches barely count
    const acc = new Float32Array(lw * lh * 3), wsum = new Float32Array(lw * lh);
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i], q = nn[i]; const px0 = p % lw, py0 = (p - px0) / lw, qx0 = q % lw, qy0 = (q - qx0) / lw;
      const wgt = Math.exp(-nd[i] / (2 * sigma2));
      for (let dy = -PR; dy <= PR; dy++) for (let dx = -PR; dx <= PR; dx++) {
        const t = (py0 + dy) * lw + px0 + dx; if (!m[t]) continue;
        const sIdx = ((qy0 + dy) * lw + qx0 + dx) * 3;
        acc[t * 3] += wgt * img[sIdx]; acc[t * 3 + 1] += wgt * img[sIdx + 1]; acc[t * 3 + 2] += wgt * img[sIdx + 2]; wsum[t] += wgt;
      }
    }
    for (let t = 0; t < lw * lh; t++) if (m[t] && wsum[t] > 0) for (let c = 0; c < 3; c++) img[t * 3 + c] = acc[t * 3 + c] / wsum[t];
  }
  console.log(`level ${l}: ${lw}x${lh}, ${targets.length} target patches, ${srcList.length} source patches`);
}
const px = levels[0].img;
const filled = Buffer.alloc(data.length);
for (let i = 0; i < data.length; i++) filled[i] = Math.max(0, Math.min(255, Math.round(px[i])));
let maskedCount = 0; for (let i = 0; i < mask.length; i++) maskedCount += mask[i];

// 5. Composite the filled window back and save.
const patch = await sharp(filled, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
await cropped.clone()
  .composite([{ input: patch, left: win.left, top: win.top }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(target);

console.log(`hero-stage-clean.jpg written ${W}x${H}; filled ${maskedCount} px in ${comp} components`);

if (preview) {
  const dir = process.env.PREVIEW_DIR ?? path.join(root, '.cache');
  fs.mkdirSync(dir, { recursive: true });
  await sharp(target).extract({ left: 780, top: 320, width: 500, height: 150 }).resize({ width: 1500 }).png().toFile(path.join(dir, 'hero-wall-after.png'));
  await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: w, height: h, channels: 1 } }).png().toFile(path.join(dir, 'hero-wall-mask.png'));
  console.log('previews in', dir);
}
