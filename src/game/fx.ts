// Particles, popups, bubbles, rings — purely visual effects.
import { drawSprite, Sprite } from '../core/gfx';
import { drawText, textWidth } from '../core/text';
import { FX } from '../art/props';

export interface Particle {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  color: string;
  size: number;
  glow?: boolean;
  drag?: number;
}

export interface Popup {
  text: string;
  x: number;
  z: number;
  y: number;
  t: number;
  life: number;
  color: string;
  outline: string;
  scale: number;
  vy: number;
  size: 8 | 12;
}

export interface Bubble {
  text: string;
  x: number;
  z: number;
  y: number;
  t: number;
  life: number;
  follow?: { x: number; z: number; y: number; dead?: boolean };
  dy: number;
  color: string;
}

export interface Ring {
  x: number;
  z: number;
  r: number;
  vr: number;
  life: number;
  max: number;
  color: string;
  flat: number;
}

export interface SpriteFx {
  frames: Sprite[];
  x: number;
  z: number;
  y: number;
  t: number;
  rate: number;
  flip?: boolean;
  alpha?: number;
  add?: boolean;
}

export interface Ghost {
  spr: Sprite;
  x: number;
  z: number;
  y: number;
  flip: boolean;
  life: number;
  max: number;
  tint: string;
}

export class Fx {
  parts: Particle[] = [];
  pops: Popup[] = [];
  bubbles: Bubble[] = [];
  rings: Ring[] = [];
  sprites: SpriteFx[] = [];
  ghosts: Ghost[] = [];

  clear() {
    this.parts.length = 0;
    this.pops.length = 0;
    this.bubbles.length = 0;
    this.rings.length = 0;
    this.sprites.length = 0;
    this.ghosts.length = 0;
  }

  burst(x: number, z: number, y: number, n: number, colors: string[], speed = 2.5, g = 0.15, life = 24, size = 1, glow = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x,
        z,
        y,
        vx: Math.cos(a) * s,
        vz: (Math.random() - 0.5) * 0.6,
        vy: Math.abs(Math.sin(a)) * s * 0.9 + 0.5,
        g,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
        color: colors[i % colors.length],
        size: size + (Math.random() < 0.3 ? 1 : 0),
        glow,
      });
    }
  }
  dust(x: number, z: number, n = 4, dir = 0) {
    for (let i = 0; i < n; i++)
      this.parts.push({
        x: x + (Math.random() - 0.5) * 8,
        z: z + (Math.random() - 0.5) * 2,
        y: Math.random() * 3,
        vx: dir * (0.5 + Math.random()) + (Math.random() - 0.5) * 0.8,
        vz: 0,
        vy: 0.3 + Math.random() * 0.5,
        g: 0.02,
        life: 18 + Math.random() * 10,
        max: 26,
        color: Math.random() < 0.5 ? '#d8d0c0' : '#b8b0a4',
        size: 2,
        drag: 0.92,
      });
  }
  spark(x: number, z: number, y: number, kind: 'spark' | 'sparkBlue' | 'sparkRed' = 'spark') {
    this.sprites.push({ frames: FX[kind], x, z, y, t: 0, rate: 3 });
  }
  pop(text: string, x: number, z: number, y: number, color = '#ffe040', scale = 1, life = 50, size: 8 | 12 = 12, outline = '#200810') {
    this.pops.push({ text, x, z, y, t: 0, life, color, outline, scale, vy: 0.6, size });
  }
  say(text: string, follow: { x: number; z: number; y: number; dead?: boolean } | null, x: number, z: number, dy = 56, life = 100, color = '#1a1020') {
    // replace existing bubble for the same entity
    if (follow) this.bubbles = this.bubbles.filter((b) => b.follow !== follow);
    this.bubbles.push({ text, x, z, y: 0, t: 0, life, follow: follow || undefined, dy, color });
  }
  ring(x: number, z: number, color = '#ffffff', vr = 3, life = 16, flat = 0.32, r = 4) {
    this.rings.push({ x, z, r, vr, life, max: life, color, flat });
  }
  ghost(spr: Sprite, x: number, z: number, y: number, flip: boolean, tint = 'rgba(80,200,255,0.5)', life = 12) {
    this.ghosts.push({ spr, x, z, y, flip, life, max: life, tint });
  }

  update() {
    for (const p of this.parts) {
      p.x += p.vx;
      p.z += p.vz;
      p.y += p.vy;
      p.vy -= p.g;
      if (p.drag) {
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      if (p.y < 0 && p.g > 0.05) {
        p.y = 0;
        p.vy *= -0.4;
        p.vx *= 0.6;
      }
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) {
      p.t++;
      p.y += p.vy;
      p.vy *= 0.92;
    }
    this.pops = this.pops.filter((p) => p.t < p.life);
    for (const b of this.bubbles) b.t++;
    this.bubbles = this.bubbles.filter((b) => b.t < b.life && !(b.follow && b.follow.dead && b.t > 30));
    for (const r of this.rings) {
      r.r += r.vr;
      r.vr *= 0.94;
      r.life--;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const s of this.sprites) s.t++;
    this.sprites = this.sprites.filter((s) => s.t < s.frames.length * s.rate);
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  drawUnder(ctx: CanvasRenderingContext2D, camX: number) {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.min(1, (r.life / r.max) * 1.5);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(Math.round(r.x - camX), Math.round(r.z), r.r, r.r * r.flat, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const g of this.ghosts) {
      ctx.globalAlpha = (g.life / g.max) * 0.6;
      drawSprite(ctx, g.spr, g.x - camX, g.z - g.y, g.flip, false);
    }
    ctx.globalAlpha = 1;
  }

  drawOver(ctx: CanvasRenderingContext2D, camX: number) {
    for (const p of this.parts) {
      const a = Math.min(1, p.life / (p.max * 0.4));
      ctx.globalAlpha = a;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.z - p.y), p.size, p.size);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    for (const s of this.sprites) {
      const f = Math.min(s.frames.length - 1, Math.floor(s.t / s.rate));
      drawSprite(ctx, s.frames[f], s.x - camX, s.z - s.y, s.flip);
    }
    for (const p of this.pops) {
      const k = p.t < 6 ? 1 + (6 - p.t) * 0.12 : 1;
      if (p.t > p.life - 10 && p.t % 2) continue;
      drawText(ctx, p.text, p.x - camX, p.z - p.y, {
        color: p.color,
        outline: p.outline,
        align: 'center',
        scale: Math.round(p.scale * k * 2) / 2,
        size: p.size,
        thickOutline: p.scale >= 2,
      });
    }
    for (const b of this.bubbles) {
      let bx = b.x;
      let bz = b.z;
      let by = 0;
      if (b.follow) {
        bx = b.follow.x;
        bz = b.follow.z;
        by = b.follow.y;
      }
      const w = textWidth(b.text, 12) + 8;
      const x = Math.round(bx - camX - w / 2);
      const y = Math.round(bz - by - b.dy - 16 - (b.t < 6 ? 6 - b.t : 0));
      const cx = Math.max(2, Math.min(480 - w - 2, x));
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(cx - 1, y - 1, w + 2, 17);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, y, w, 15);
      // tail
      const tx = Math.max(cx + 3, Math.min(cx + w - 6, Math.round(bx - camX)));
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(tx - 1, y + 15, 5, 2);
      ctx.fillRect(tx, y + 17, 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx, y + 15, 3, 1);
      ctx.fillRect(tx + 1, y + 16, 1, 2);
      drawText(ctx, b.text, cx + 4, y + 2, { color: b.color, outline: null });
    }
  }
}
