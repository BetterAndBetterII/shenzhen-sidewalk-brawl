// Low-level pixel painting helpers. Everything is drawn into Uint32 buffers
// (ABGR little-endian) and then converted to canvases; no anti-aliasing ever.

export const W = 480;
export const H = 270;

const colorCache = new Map<string, number>();
export function col(hex: string, alpha = 255): number {
  const key = hex + alpha;
  const c = colorCache.get(key);
  if (c !== undefined) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const v = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
  colorCache.set(key, v);
  return v;
}

export function shadeHex(hex: string, f: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const m = (v: number) => {
    const o = f >= 0 ? v + (255 - v) * f : v * (1 + f);
    return Math.max(0, Math.min(255, Math.round(o)));
  };
  return '#' + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export class PixelBuf {
  w: number;
  h: number;
  data: Uint32Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }
  set(x: number, y: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  circle(cx: number, cy: number, r: number, c: number) {
    const rr = r * r + r * 0.8;
    for (let y = Math.floor(-r); y <= Math.ceil(r); y++)
      for (let x = Math.floor(-r); x <= Math.ceil(r); x++) if (x * x + y * y <= rr) this.set(cx + x, cy + y, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
      for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++)
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.set(cx + x, cy + y, c);
  }
  ring(cx: number, cy: number, r: number, c: number) {
    const steps = Math.max(12, Math.ceil(r * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 1000; i++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** capsule from (x0,y0) to (x1,y1) radius r */
  thick(x0: number, y0: number, x1: number, y1: number, r: number, c: number) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
    }
  }
  poly(pts: number[][], c: number) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
  }
  /** add a 1px outline around opaque pixels */
  outline(c: number, diag = false) {
    const { w, h, data } = this;
    const out = data.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (data[y * w + x] >>> 24) continue;
        let n =
          (x > 0 && data[y * w + x - 1] >>> 24) ||
          (x < w - 1 && data[y * w + x + 1] >>> 24) ||
          (y > 0 && data[(y - 1) * w + x] >>> 24) ||
          (y < h - 1 && data[(y + 1) * w + x] >>> 24);
        if (!n && diag)
          n =
            (x > 0 && y > 0 && data[(y - 1) * w + x - 1] >>> 24) ||
            (x < w - 1 && y > 0 && data[(y - 1) * w + x + 1] >>> 24) ||
            (x > 0 && y < h - 1 && data[(y + 1) * w + x - 1] >>> 24) ||
            (x < w - 1 && y < h - 1 && data[(y + 1) * w + x + 1] >>> 24);
        if (n) out[y * w + x] = c;
      }
    this.data = out;
  }
  /** replace colors in place */
  replace(from: number, to: number) {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
  }
  blit(src: PixelBuf, dx: number, dy: number, flip = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flip ? src.w - 1 - x : x)];
        if (v >>> 24) this.set(dx + x, dy + y, v);
      }
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

export interface Sprite {
  c: HTMLCanvasElement;
  ox: number; // anchor x inside canvas
  oy: number; // anchor y inside canvas
  white?: HTMLCanvasElement;
  flipped?: HTMLCanvasElement;
  whiteFlipped?: HTMLCanvasElement;
}

export function makeSprite(buf: PixelBuf, ox: number, oy: number): Sprite {
  return { c: buf.toCanvas(), ox, oy };
}

export function silhouette(src: HTMLCanvasElement, color = '#ffffff'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function flipCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return cv;
}

/** Draw sprite with anchor at (x,y). flip = facing left. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  flip = false,
  white = false,
) {
  let img: HTMLCanvasElement;
  if (white) {
    if (!s.white) s.white = silhouette(s.c);
    if (flip) {
      if (!s.whiteFlipped) s.whiteFlipped = flipCanvas(s.white);
      img = s.whiteFlipped;
    } else img = s.white;
  } else if (flip) {
    if (!s.flipped) s.flipped = flipCanvas(s.c);
    img = s.flipped;
  } else img = s.c;
  const dx = flip ? Math.round(x - (s.c.width - s.ox)) : Math.round(x - s.ox);
  ctx.drawImage(img, dx, Math.round(y - s.oy));
}

export function drawSpriteRot(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  ang: number,
  flip = false,
  pivotY = 0,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - pivotY));
  ctx.rotate(ang);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(s.c, -s.ox, -s.oy + pivotY);
  ctx.restore();
}

export function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Deterministic RNG (mulberry32)
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
export function randi(a: number, b: number) {
  return Math.floor(a + Math.random() * (b - a + 1));
}
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Ordered-dither vertical gradient on a ctx */
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function ditherGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
) {
  // bands with dithered transitions
  const n = colors.length - 1;
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * n;
    const i0 = Math.min(n - 1, Math.floor(t));
    const f = t - i0;
    for (let i = 0; i < w; i++) {
      const th = bayer[((j & 3) << 2) | (i & 3)] / 16;
      ctx.fillStyle = f > th ? colors[i0 + 1] : colors[i0];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/** Faster dither gradient: draws to ImageData */
export function ditherGradientBuf(buf: PixelBuf, x: number, y: number, w: number, h: number, colors: string[]) {
  const n = colors.length - 1;
  const cs = colors.map((c) => col(c));
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * n;
    const i0 = Math.min(n - 1, Math.floor(t));
    const f = t - i0;
    for (let i = 0; i < w; i++) {
      const th = bayer[((j & 3) << 2) | (i & 3)] / 16;
      buf.set(x + i, y + j, f > th ? cs[i0 + 1] : cs[i0]);
    }
  }
}

export interface Painter {
  set(x: number, y: number, c: number): void;
  rect(x: number, y: number, w: number, h: number, c: number): void;
  circle(cx: number, cy: number, r: number, c: number): void;
  line(x0: number, y0: number, x1: number, y1: number, c: number): void;
  thick(x0: number, y0: number, x1: number, y1: number, r: number, c: number): void;
  poly(pts: number[][], c: number): void;
}

/** Paints into a PixelBuf with all coordinates scaled around (ox, oy) — crisp large sprites. */
export class ScaledPainter implements Painter {
  constructor(public b: PixelBuf, public ox: number, public oy: number, public s: number) {}
  private X(x: number) {
    return this.ox + (x - this.ox) * this.s;
  }
  private Y(y: number) {
    return this.oy + (y - this.oy) * this.s;
  }
  set(x: number, y: number, c: number) {
    this.b.rect(this.X(x), this.Y(y), Math.round(this.s), Math.round(this.s), c);
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    this.b.rect(this.X(x), this.Y(y), Math.round(w * this.s), Math.round(h * this.s), c);
  }
  circle(cx: number, cy: number, r: number, c: number) {
    this.b.circle(this.X(cx), this.Y(cy), r * this.s, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    this.b.thick(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.s * 0.45, c);
  }
  thick(x0: number, y0: number, x1: number, y1: number, r: number, c: number) {
    this.b.thick(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), r * this.s, c);
  }
  poly(pts: number[][], c: number) {
    this.b.poly(
      pts.map((p) => [this.X(p[0]), this.Y(p[1])]),
      c,
    );
  }
}
