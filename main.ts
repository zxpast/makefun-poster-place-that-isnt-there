// makefun-poster-place-that-isnt-there — "VELMORA"
// A travel poster for a place that does not exist: Velmora, the lantern
// harbour beyond the last map. One 1024x1024 image, drawn procedurally:
// gradient dusk sky, a low amber moon, a stacked-glass lantern tower on
// a rocky islet, floating lanterns, still water, and the place name set
// in large type on a cream band. Node 22, standard library only.
// No network, no clock, no randomness (fixed-seed PRNG) — two runs
// write byte-identical output.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const INK: RGB = [28, 24, 46];
const CREAM: RGB = [246, 239, 219];
const GOLD: RGB = [198, 138, 58];
const AMBER: RGB = [255, 196, 107];
const EMBER: RGB = [232, 131, 58];
const MOON: RGB = [247, 231, 188];
const TEAL: RGB = [86, 178, 168];

// ------------------------------------------------------------------- CRC32
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(rgb: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ helpers
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}
// Fixed-seed PRNG (mulberry32) — deterministic, no Math.random anywhere.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ canvas
class Canvas {
  w: number;
  h: number;
  px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const o = (iy * this.w + ix) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    const ix = Math.max(0, Math.min(this.w - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(this.h - 1, Math.round(y)));
    const o = (iy * this.w + ix) * 3;
    return [this.px[o], this.px[o + 1], this.px[o + 2]];
  }
  // alpha blend a colour onto the pixel (alpha 0..1)
  blend(x: number, y: number, c: RGB, a: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const o = (iy * this.w + ix) * 3;
    this.px[o] = Math.round(lerp(this.px[o], c[0], a));
    this.px[o + 1] = Math.round(lerp(this.px[o + 1], c[1], a));
    this.px[o + 2] = Math.round(lerp(this.px[o + 2], c[2], a));
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      let o = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.px[o] = c[0];
        this.px[o + 1] = c[1];
        this.px[o + 2] = c[2];
        o += 3;
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.max(0.5, r);
    const x0 = Math.max(0, Math.floor(cx - rr));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + rr));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= rr * rr) this.set(x, y, c);
      }
    }
  }
  // soft glow disc: alpha falls off linearly to the edge
  glow(cx: number, cy: number, r: number, c: RGB, peak: number): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d < 1) this.blend(x, y, c, peak * (1 - d));
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          if (a >= 1) this.set(x, y, c);
          else this.blend(x, y, c, a);
        }
      }
    }
  }
  fillPoly(pts: Array<[number, number]>, c: RGB): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const ys = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= ys && b[1] > ys) || (b[1] <= ys && a[1] > ys)) {
          const t = (ys - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.ceil(xs[i] - 0.5));
        const xb = Math.min(this.w - 1, Math.floor(xs[i + 1] - 0.5));
        for (let x = xa; x <= xb; x++) this.set(x, y, c);
      }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const hw = Math.max(0.5, w / 2);
    if (len < 0.01) {
      this.disc(x0, y0, hw, c);
      return;
    }
    const nx = (-dy / len) * hw;
    const ny = (dx / len) * hw;
    this.fillPoly(
      [
        [x0 + nx, y0 + ny],
        [x1 + nx, y1 + ny],
        [x1 - nx, y1 - ny],
        [x0 - nx, y0 - ny],
      ],
      c,
    );
    this.disc(x0, y0, hw, c);
    this.disc(x1, y1, hw, c);
  }
  // vertical gradient between stops: [position 0..1, colour]
  vgrad(y0: number, y1: number, stops: Array<[number, RGB]>): void {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      const t = (y - y0) / (y1 - y0);
      let c: RGB = stops[stops.length - 1][1];
      for (let i = 0; i + 1 < stops.length; i++) {
        if (t >= stops[i][0] && t <= stops[i + 1][0]) {
          const lt = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
          c = lerpRGB(stops[i][1], stops[i + 1][1], lt);
          break;
        }
      }
      this.fillRect(0, y, this.w, 1, c);
    }
  }
}

// ------------------------------------------------------------- bitmap font
// 5x7 pixel glyphs, rows top to bottom, "#" = on. Only the characters the
// poster uses are defined; anything else falls back to "?".
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};

function textWidth(s: string, size: number): number {
  // advance = 6 cells per character, minus trailing gap
  return Math.max(0, s.length * 6 * size - size);
}

function drawText(cv: Canvas, s: string, x: number, y: number, size: number, c: RGB): void {
  let cx = Math.round(x);
  const y0 = Math.round(y);
  for (const ch of s) {
    const g = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          cv.fillRect(cx + col * size, y0 + r * size, size, size, c);
        }
      }
    }
    cx += 6 * size;
  }
}

function drawTextCentred(cv: Canvas, s: string, cx: number, y: number, size: number, c: RGB): void {
  drawText(cv, s, cx - textWidth(s, size) / 2, y, size, c);
}

// ------------------------------------------------------------------ scene
// Velmora: a harbour where the night stays lit. One landmark — the
// stacked-glass Lantern Tower — rises from a rocky islet; paper lanterns
// drift above a still lagoon under a low amber moon.

const HORIZON = 640; // where sky meets water
const BAND_TOP = 830; // where the cream name band starts
const TOWER_X = 400;

function drawSky(cv: Canvas, rnd: () => number): void {
  cv.vgrad(0, HORIZON, [
    [0, [20, 27, 51]],
    [0.35, [44, 42, 85]],
    [0.62, [107, 67, 112]],
    [0.85, [201, 122, 90]],
    [1, [232, 168, 92]],
  ]);
  // stars, only in the upper dark sky
  for (let i = 0; i < 150; i++) {
    const x = rnd() * W;
    const y = rnd() * 500;
    const a = 0.25 + rnd() * 0.65;
    const s = rnd();
    if (s > 0.92) {
      // bright star with a cross sparkle
      cv.blend(x, y, CREAM, a);
      cv.thickLine(x - 5, y, x + 5, y, 1.5, CREAM);
      cv.thickLine(x, y - 5, x, y + 5, 1.5, CREAM);
    } else if (s > 0.6) {
      cv.fillRect(x, y, 2, 2, CREAM);
      cv.blend(x, y, CREAM, a);
    } else {
      cv.blend(x, y, CREAM, a * 0.8);
    }
  }
  // low amber moon, upper right, with a soft halo
  cv.glow(762, 205, 210, MOON, 0.16);
  cv.glow(762, 205, 140, MOON, 0.22);
  cv.disc(762, 205, 88, MOON);
  cv.disc(735, 185, 12, [233, 214, 164]);
  cv.disc(785, 230, 9, [233, 214, 164]);
  cv.disc(770, 175, 6, [233, 214, 164]);
  // moonlight path shimmering down toward the water is painted later,
  // over the sea; first the thin high clouds
  cv.ellipse(240, 300, 150, 13, [214, 170, 150], 0.35);
  cv.ellipse(330, 322, 110, 10, [214, 170, 150], 0.28);
  cv.ellipse(820, 420, 170, 12, [232, 180, 140], 0.3);
  cv.ellipse(700, 445, 100, 9, [232, 180, 140], 0.24);
  // birds, small and far
  const birds: Array<[number, number, number]> = [
    [180, 250, 14],
    [230, 225, 11],
    [560, 180, 12],
    [620, 210, 9],
    [880, 300, 12],
  ];
  for (const [bx, by, bs] of birds) {
    cv.thickLine(bx - bs, by, bx, by - bs * 0.45, 2.5, INK);
    cv.thickLine(bx, by - bs * 0.45, bx + bs, by, 2.5, INK);
  }
}

function drawMountains(cv: Canvas): void {
  // far ridge, violet
  cv.fillPoly(
    [
      [0, HORIZON],
      [0, 588],
      [90, 556],
      [180, 592],
      [260, 548],
      [340, 590],
      [430, 566],
      [520, 600],
      [620, 552],
      [720, 594],
      [820, 560],
      [920, 596],
      [1024, 566],
      [1024, HORIZON],
    ],
    [58, 51, 88],
  );
  // near ridge, darker, with a far-shore town of tiny lights
  cv.fillPoly(
    [
      [0, HORIZON],
      [0, 612],
      [120, 588],
      [210, 616],
      [330, 592],
      [470, 620],
      [600, 596],
      [740, 622],
      [870, 600],
      [1024, 624],
      [1024, HORIZON],
    ],
    [36, 31, 62],
  );
  const town: Array<[number, number]> = [
    [70, 606], [150, 600], [260, 608], [560, 610], [680, 614], [900, 608],
  ];
  for (const [tx, ty] of town) cv.disc(tx, ty, 2.5, AMBER);
}

function drawTower(cv: Canvas): void {
  // rocky islet
  cv.fillPoly(
    [
      [TOWER_X - 118, HORIZON],
      [TOWER_X - 96, 622],
      [TOWER_X - 52, 606],
      [TOWER_X + 48, 606],
      [TOWER_X + 92, 624],
      [TOWER_X + 116, HORIZON],
    ],
    [30, 24, 48],
  );
  cv.fillPoly(
    [
      [TOWER_X - 96, 622],
      [TOWER_X - 52, 606],
      [TOWER_X + 48, 606],
      [TOWER_X + 92, 624],
      [TOWER_X + 60, HORIZON],
      [TOWER_X - 60, HORIZON],
    ],
    [42, 34, 62],
  );
  // stacked glass chambers, widest at the base, glowing warm
  const tiers: Array<[number, number, number, number]> = [
    // [centre y, width, height, glow radius]
    [596, 148, 52, 120],
    [548, 128, 48, 104],
    [504, 108, 46, 90],
    [464, 88, 44, 76],
    [428, 68, 42, 62],
  ];
  for (const [ty, tw, th, gr] of tiers) {
    cv.glow(TOWER_X, ty, gr, AMBER, 0.16);
  }
  for (const [ty, tw, th] of tiers) {
    const y0 = ty - th / 2;
    // glass body: warm core with ember edges
    cv.fillRect(TOWER_X - tw / 2, y0, tw, th, AMBER);
    cv.fillRect(TOWER_X - tw / 2, y0, tw, 5, EMBER);
    cv.fillRect(TOWER_X - tw / 2, y0 + th - 5, tw, 5, EMBER);
    cv.fillRect(TOWER_X - tw / 2 + 8, y0 + 6, tw / 3, th - 12, [255, 220, 150]);
    // dark frame bars
    cv.fillRect(TOWER_X - tw / 2, y0, 5, th, INK);
    cv.fillRect(TOWER_X + tw / 2 - 5, y0, 5, th, INK);
    cv.fillRect(TOWER_X - tw / 2, y0, tw, 4, INK);
    cv.fillRect(TOWER_X - tw / 2, y0 + th - 4, tw, 4, INK);
    // centre mullion
    cv.fillRect(TOWER_X - 2, y0, 4, th, INK);
  }
  // domed cap + spire + beacon orb
  cv.ellipse(TOWER_X, 404, 40, 16, INK);
  cv.fillRect(TOWER_X - 3, 356, 6, 44, INK);
  cv.glow(TOWER_X, 344, 64, AMBER, 0.5);
  cv.disc(TOWER_X, 344, 17, [255, 233, 168]);
  cv.disc(TOWER_X, 344, 9, [255, 248, 214]);
}

function drawSea(cv: Canvas, rnd: () => number): void {
  cv.vgrad(HORIZON, BAND_TOP, [
    [0, [46, 58, 94]],
    [0.5, [34, 44, 76]],
    [1, [26, 36, 64]],
  ]);
  // moonlight path: a wide soft column of amber shimmer under the moon
  for (let y = HORIZON + 4; y < BAND_TOP - 8; y += 5) {
    const depth = (y - HORIZON) / (BAND_TOP - HORIZON);
    const half = 60 + depth * 150 + Math.sin(y * 0.11) * 22;
    const cx = 762 + Math.sin(y * 0.05) * 18;
    for (let x = Math.round(cx - half); x < cx + half; x += 7) {
      if (rnd() < 0.5) cv.blend(x, y, AMBER, 0.10 + rnd() * 0.22);
    }
  }
  // tower reflection: vertical amber streaks under the islet
  for (let y = HORIZON + 2; y < BAND_TOP - 10; y += 6) {
    const depth = (y - HORIZON) / (BAND_TOP - HORIZON);
    const wob = Math.sin(y * 0.23) * 26 + Math.sin(y * 0.071) * 14;
    const half = 52 * (1 - depth * 0.45);
    const cx = TOWER_X + wob;
    for (let x = Math.round(cx - half); x < cx + half; x += 6) {
      if (rnd() < 0.55) cv.blend(x, y, AMBER, 0.22 * (1 - depth * 0.6));
    }
  }
  // scattered shimmer dashes, teal and cream
  for (let i = 0; i < 110; i++) {
    const x = rnd() * W;
    const y = HORIZON + 8 + rnd() * (BAND_TOP - HORIZON - 20);
    const len = 18 + rnd() * 70;
    const c = rnd() < 0.5 ? TEAL : CREAM;
    for (let xx = Math.round(x); xx < Math.round(x + len); xx++) {
      cv.blend(xx, y, c, 0.10 + rnd() * 0.18);
    }
  }
}

function drawLanterns(cv: Canvas, rnd: () => number): void {
  // floating paper lanterns drifting over sky and sea
  const spots: Array<[number, number, number]> = [];
  for (let i = 0; i < 14; i++) {
    const x = 60 + rnd() * (W - 120);
    const y = 120 + rnd() * 560;
    const r = 7 + rnd() * 7;
    spots.push([x, y, r]);
  }
  // keep lanterns clear of the moon and the tower's beacon
  const clear = spots.filter(
    ([x, y]) => Math.hypot(x - 762, y - 205) > 130 && Math.hypot(x - TOWER_X, y - 344) > 70,
  );
  for (const [x, y, r] of clear) {
    cv.glow(x, y, r * 3.2, AMBER, 0.35);
    cv.disc(x, y, r, AMBER);
    cv.disc(x - r * 0.25, y - r * 0.25, r * 0.55, [255, 226, 160]);
    cv.thickLine(x, y + r, x, y + r + 16, 1.5, [120, 90, 60]);
    cv.disc(x, y + r + 18, 2.5, EMBER);
  }
}

function drawBoats(cv: Canvas): void {
  const boats: Array<[number, number, number]> = [
    [180, 706, 1],
    [716, 752, 0.8],
  ];
  for (const [bx, by, s] of boats) {
    // hull
    cv.fillPoly(
      [
        [bx - 52 * s, by],
        [bx + 52 * s, by],
        [bx + 34 * s, by + 14 * s],
        [bx - 34 * s, by + 14 * s],
      ],
      INK,
    );
    // mast + lantern
    cv.thickLine(bx, by - 34 * s, bx, by, 2.5, INK);
    cv.glow(bx, by - 40 * s, 20, AMBER, 0.5);
    cv.disc(bx, by - 40 * s, 6 * s, AMBER);
    // reflection dash
    cv.fillRect(bx - 30 * s, by + 18 * s, 60 * s, 2, AMBER);
  }
}

function drawBand(cv: Canvas): void {
  cv.fillRect(0, BAND_TOP, W, H - BAND_TOP, CREAM);
  cv.fillRect(0, BAND_TOP, W, 4, INK);
  cv.fillRect(0, BAND_TOP + 8, W, 2, GOLD);
  // eyebrow, name, tagline — the place name is the poster
  drawTextCentred(cv, "THE LANTERN HARBOUR", W / 2, BAND_TOP + 22, 3, [122, 74, 62]);
  drawTextCentred(cv, "VELMORA", W / 2, BAND_TOP + 48, 13, INK);
  drawTextCentred(cv, "WHERE THE NIGHT NEVER GOES DARK", W / 2, BAND_TOP + 148, 4, [90, 60, 88]);
}

function drawPoster(): Canvas {
  const cv = new Canvas(W, H, CREAM);
  const rnd = mulberry32(20261121);
  drawSky(cv, rnd);
  drawMountains(cv);
  drawTower(cv);
  drawSea(cv, rnd);
  drawLanterns(cv, rnd);
  drawBoats(cv);
  drawBand(cv);
  // poster frame
  cv.fillRect(0, 0, W, 8, INK);
  cv.fillRect(0, H - 8, W, 8, INK);
  cv.fillRect(0, 0, 8, H, INK);
  cv.fillRect(W - 8, 0, 8, H, INK);
  cv.fillRect(14, 14, W - 28, 2, GOLD);
  cv.fillRect(14, H - 16, W - 28, 2, GOLD);
  return cv;
}

// -------------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const cv = drawPoster();
  const png = encodePNG(cv.px, W, H);
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
  console.log("wrote entry.png: " + png.length + " bytes, " + W + "x" + H);
}

main();
