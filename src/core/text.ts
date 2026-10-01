// Crisp pixel text: render with a bitmap-style web font, threshold alpha,
// recolor, add outline/shadow, cache the result as a canvas.
import { col, PixelBuf } from './gfx';
import f12url from '../assets/fonts/px12.woff2?url';
import f8url from '../assets/fonts/px8.woff2?url';

export type FontSize = 12 | 8;
const FAMILY: Record<FontSize, string> = { 12: 'Px12', 8: 'Px8' };

export async function loadFonts() {
  try {
    const a = new FontFace('Px12', `url(${f12url})`);
    const b = new FontFace('Px8', `url(${f8url})`);
    const [fa, fb] = await Promise.all([a.load(), b.load()]);
    document.fonts.add(fa);
    document.fonts.add(fb);
  } catch (e) {
    console.warn('font load failed', e);
  }
}

export interface TextOpts {
  size?: FontSize;
  color?: string;
  outline?: string | null;
  shadow?: string | null;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  gradient?: string[];
  thickOutline?: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();
const measureCv = document.createElement('canvas');
const mctx = measureCv.getContext('2d')!;

export function textWidth(str: string, size: FontSize = 12): number {
  size = effSize(str, size);
  mctx.font = `${size}px ${FAMILY[size]}`;
  return Math.ceil(mctx.measureText(str).width);
}

function render(str: string, o: Required<Omit<TextOpts, 'scale' | 'align'>>): HTMLCanvasElement {
  const size = o.size;
  const tw = textWidth(str, size);
  const pad = o.thickOutline ? 3 : 2;
  const w = Math.max(1, tw + pad * 2 + 1);
  const h = size + pad * 2 + 2;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.font = `${size}px ${FAMILY[size]}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(str, pad, pad + (size === 12 ? 0 : 0));
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint32Array(img.data.buffer);
  const buf = new PixelBuf(w, h);
  const grad = o.gradient && o.gradient.length ? o.gradient.map((c) => col(c)) : null;
  const base = col(o.color);
  // find glyph vertical extent for gradient mapping
  let top = h,
    bot = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (src[y * w + x] >>> 24 >= 110) {
        if (y < top) top = y;
        if (y > bot) bot = y;
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24 >= 110) {
        let c = base;
        if (grad) {
          const t = (y - top) / Math.max(1, bot - top);
          c = grad[Math.min(grad.length - 1, Math.floor(t * grad.length))];
        }
        buf.data[y * w + x] = c;
      }
    }
  if (o.outline) {
    buf.outline(col(o.outline), true);
    if (o.thickOutline) buf.outline(col(o.outline), false);
  }
  if (o.shadow) {
    const sh = col(o.shadow);
    const copy = buf.data.slice();
    for (let y = h - 2; y >= 0; y--)
      for (let x = w - 2; x >= 0; x--) {
        if (copy[y * w + x] >>> 24 && !(copy[(y + 1) * w + x + 1] >>> 24)) buf.data[(y + 1) * w + x + 1] = sh;
      }
  }
  return buf.toCanvas();
}

const CJK = /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/;
/** 8px CJK glyphs are unreadable, so CJK text is always rendered at 12px. */
export function effSize(str: string, size: FontSize = 12): FontSize {
  return size === 8 && CJK.test(str) ? 12 : size;
}

export function textCanvas(str: string, opts: TextOpts = {}): HTMLCanvasElement {
  const o = {
    size: effSize(str, opts.size ?? 12),
    color: opts.color ?? '#ffffff',
    outline: opts.outline === undefined ? '#100818' : opts.outline,
    shadow: opts.shadow === undefined ? null : opts.shadow,
    gradient: opts.gradient ?? [],
    thickOutline: opts.thickOutline ?? false,
  } as Required<Omit<TextOpts, 'scale' | 'align'>>;
  const key = `${str}|${o.size}|${o.color}|${o.outline}|${o.shadow}|${o.gradient.join(',')}|${o.thickOutline}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 900) cache.clear();
    c = render(str, o);
    cache.set(key, c);
  }
  return c;
}

/** Draw text; (x,y) is top-left of the glyph box (or center/right per align). Returns width drawn. */
export function drawText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, opts: TextOpts = {}): number {
  if (!str) return 0;
  const c = textCanvas(str, opts);
  const s = opts.scale ?? 1;
  const pad = opts.thickOutline ? 3 : 2;
  const w = c.width * s;
  let dx = x - pad * s;
  if (opts.align === 'center') dx = x - w / 2;
  else if (opts.align === 'right') dx = x - w + pad * s;
  ctx.drawImage(c, Math.round(dx), Math.round(y - pad * s), Math.round(w), Math.round(c.height * s));
  return w - pad * 2 * s;
}

/** Word-wrap for CJK + latin by character width. */
export function wrapText(str: string, maxW: number, size: FontSize = 12): string[] {
  const lines: string[] = [];
  for (const para of str.split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (textWidth(cur + ch, size) > maxW && cur) {
        // avoid line-start punctuation
        if ('，。！？、：；」）'.includes(ch)) {
          cur += ch;
          continue;
        }
        lines.push(cur);
        cur = ch;
      } else cur += ch;
    }
    lines.push(cur);
  }
  return lines;
}
