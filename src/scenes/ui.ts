// Shared menu widget & drawing helpers for scenes.
import { audio } from '../core/audio';
import { input } from '../core/input';
import { drawText, textWidth } from '../core/text';
import { W, H } from '../core/gfx';

export interface MenuItem {
  label: string | (() => string);
  hint?: string;
  disabled?: () => boolean;
  action?: () => void;
  left?: () => void;
  right?: () => void;
}

export class Menu {
  sel = 0;
  t = 0;
  rects: { x: number; y: number; w: number; h: number }[] = [];
  constructor(
    public items: MenuItem[],
    public x: number,
    public y: number,
    public lh = 16,
    public w = 160,
  ) {}
  label(i: number) {
    const l = this.items[i].label;
    return typeof l === 'function' ? l() : l;
  }
  update() {
    this.t++;
    const n = this.items.length;
    if (input.pressed('up')) {
      this.sel = (this.sel + n - 1) % n;
      audio.sfx('menu');
    }
    if (input.pressed('down')) {
      this.sel = (this.sel + 1) % n;
      audio.sfx('menu');
    }
    const it = this.items[this.sel];
    if (input.pressed('left') && it.left) {
      it.left();
      audio.sfx('menu');
    }
    if (input.pressed('right') && it.right) {
      it.right();
      audio.sfx('menu');
    }
    if (input.pressed('start') || input.pressed('punch') || input.pressed('jump')) this.activate(this.sel);
    for (const c of input.clicks) {
      this.rects.forEach((r, i) => {
        if (c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h) {
          if (this.items[i].right && !this.items[i].action) {
            this.sel = i;
            if (c.x < r.x + r.w / 2) this.items[i].left?.();
            else this.items[i].right?.();
            audio.sfx('menu');
          } else {
            this.sel = i;
            this.activate(i);
          }
        }
      });
    }
  }
  activate(i: number) {
    const it = this.items[i];
    if (it.disabled && it.disabled()) {
      audio.sfx('back');
      return;
    }
    if (it.action) {
      audio.sfx('select');
      it.action();
    } else if (it.right) {
      it.right();
      audio.sfx('menu');
    }
  }
  draw(ctx: CanvasRenderingContext2D, panel = true) {
    const n = this.items.length;
    if (panel) {
      ctx.fillStyle = 'rgba(12,6,24,0.82)';
      ctx.fillRect(this.x - this.w / 2 - 8, this.y - 6, this.w + 16, n * this.lh + 10);
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(this.x - this.w / 2 - 8, this.y - 6, this.w + 16, 1);
      ctx.fillRect(this.x - this.w / 2 - 8, this.y + n * this.lh + 3, this.w + 16, 1);
    }
    this.rects = [];
    for (let i = 0; i < n; i++) {
      const y = this.y + i * this.lh;
      const s = this.sel === i;
      const dis = this.items[i].disabled?.();
      const lbl = this.label(i);
      if (s) {
        ctx.fillStyle = 'rgba(255,208,64,0.18)';
        ctx.fillRect(this.x - this.w / 2, y - 1, this.w, this.lh - 2);
        const bob = Math.floor(this.t / 8) % 2;
        const tw = textWidth(lbl, 12);
        drawText(ctx, '▶', this.x - tw / 2 - 14 + bob, y + 1, { color: '#ffd040', size: 12 });
      }
      drawText(ctx, lbl, this.x, y + 1, { color: dis ? '#6a6070' : s ? '#ffe040' : '#ffffff', align: 'center' });
      this.rects.push({ x: this.x - this.w / 2, y: y - 1, w: this.w, h: this.lh });
    }
    const hint = this.items[this.sel].hint;
    if (hint) drawText(ctx, hint, this.x, this.y + n * this.lh + 8, { size: 8, color: '#9ad8ff', align: 'center' });
  }
}

export function speedLines(ctx: CanvasRenderingContext2D, t: number, color = 'rgba(255,255,255,0.18)') {
  ctx.fillStyle = color;
  for (let i = 0; i < 26; i++) {
    const y = (i * 53 + Math.floor(t * (2 + (i % 3)))) % H;
    const l = 30 + ((i * 71) % 120);
    const x = (i * 131 + t * 9 * (1 + (i % 4))) % (W + l) - l;
    ctx.fillRect(Math.round(x), y, l, 1);
  }
}

export function banner(ctx: CanvasRenderingContext2D, text: string, y: number, bg = '#c81a2a', fg = '#ffe040') {
  ctx.fillStyle = '#100818';
  ctx.fillRect(0, y - 1, W, 20);
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, W, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, y, W, 1);
  drawText(ctx, text, W / 2, y + 3, { color: fg, outline: '#400008', align: 'center', thickOutline: false });
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge = '#ffd040') {
  ctx.fillStyle = '#100818';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = edge;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(16,10,32,0.94)';
  ctx.fillRect(x, y, w, h);
}

export function logo(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, scale = 3) {
  const title = '深圳人行道角斗场';
  const grads = [
    ['#b0ff6a', '#3ad05a', '#1a8a3a'],
    ['#fff07a', '#ffc020', '#e07a10'],
    ['#ff9ad8', '#ff4aa0', '#c01a6a'],
    ['#9ae8ff', '#3ab0ff', '#1a5ad0'],
  ];
  const cw = 12 * scale + 1;
  const x0 = x - (title.length * cw) / 2;
  [...title].forEach((ch, i) => {
    const bob = Math.round(Math.sin(t * 0.08 + i * 0.7) * 2);
    const g = grads[(i + Math.floor(t / 40)) % grads.length];
    drawText(ctx, ch, x0 + i * cw + cw / 2, y + bob + 3, { color: '#100818', outline: '#100818', align: 'center', scale, thickOutline: true });
    drawText(ctx, ch, x0 + i * cw + cw / 2, y + bob, { gradient: g, outline: '#100818', align: 'center', scale, thickOutline: true });
  });
}
