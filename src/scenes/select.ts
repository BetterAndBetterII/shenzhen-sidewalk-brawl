// Stage select (unlocked stages only).
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { H, newCanvas, W } from '../core/gfx';
import { input } from '../core/input';
import { save, DIFF_NAMES } from '../core/save';
import { drawText } from '../core/text';
import { drawBackdrop, makeBackdrop } from '../art/backgrounds';
import { STAGES } from '../game/stages';
import { pad } from '../game/hud';
import { startGame } from './play';
import { TitleScene } from './title';
import { speedLines } from './ui';

const thumbs: HTMLCanvasElement[] = [];
function thumb(i: number) {
  if (!thumbs[i]) {
    const s = STAGES[i];
    const [big, bctx] = newCanvas(W, H);
    drawBackdrop(bctx, makeBackdrop(s.theme, 1200), 220);
    const [c, ctx] = newCanvas(120, 68);
    ctx.drawImage(big, 0, 0, W, H, 0, 0, 120, 68);
    thumbs[i] = c;
  }
  return thumbs[i];
}

export class StageSelectScene implements Scene {
  name = 'select';
  sel = 0;
  t = 0;
  rects: { x: number; y: number; w: number; h: number }[] = [];
  constructor() {
    this.sel = Math.min(save.unlocked, STAGES.length - 1);
  }
  update() {
    this.t++;
    const n = STAGES.length;
    const move = (d: number) => {
      this.sel = (this.sel + d + n) % n;
      audio.sfx('menu');
    };
    if (input.pressed('right')) move(1);
    if (input.pressed('left')) move(-1);
    if (input.pressed('down')) move(4);
    if (input.pressed('up')) move(-4);
    if (input.pressed('back') || input.pressed('kick')) {
      audio.sfx('back');
      app.go(new TitleScene(true));
      return;
    }
    let go = input.pressed('start') || input.pressed('punch') || input.pressed('jump');
    for (const c of input.clicks) {
      this.rects.forEach((r, i) => {
        if (c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h) {
          if (this.sel === i) go = true;
          else {
            this.sel = i;
            audio.sfx('menu');
          }
        }
      });
      if (c.y < 22 && c.x < 70) {
        app.go(new TitleScene(true));
        return;
      }
    }
    if (go) {
      if (this.sel > save.unlocked) {
        audio.sfx('back');
        return;
      }
      audio.sfx('select');
      startGame(this.sel);
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120a24';
    ctx.fillRect(0, 0, W, H);
    speedLines(ctx, this.t, 'rgba(120,90,200,0.15)');
    drawText(ctx, '◀ 返回', 6, 6, { size: 8, color: '#a090c0' });
    drawText(ctx, '选择关卡', W / 2, 6, { color: '#ffd040', scale: 2, align: 'center', thickOutline: true });
    this.rects = [];
    STAGES.forEach((s, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cw = 106;
      const ch = 78;
      const x = 18 + col * (cw + 8) + (row === 1 ? (cw + 8) / 2 : 0);
      const y = 40 + row * (ch + 18);
      const locked = i > save.unlocked;
      const selc = this.sel === i;
      ctx.fillStyle = selc ? (this.t % 20 < 10 ? '#ffd040' : '#ff9a20') : '#3a3050';
      ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
      ctx.fillStyle = '#100818';
      ctx.fillRect(x, y, cw, ch);
      ctx.drawImage(thumb(i), 0, 0, 120, 68, x + 1, y + 1, cw - 2, 58);
      if (locked) {
        ctx.fillStyle = 'rgba(10,6,20,0.8)';
        ctx.fillRect(x + 1, y + 1, cw - 2, 58);
        drawText(ctx, '未解锁', x + cw / 2, y + 22, { color: '#8a80a0', align: 'center' });
      }
      drawText(ctx, i === 6 ? 'FINAL' : `STAGE ${i + 1}`, x + 3, y + 2, { size: 8, color: '#ffd040' });
      drawText(ctx, s.name, x + cw / 2, y + 61, { size: 12, color: locked ? '#6a6070' : '#ffffff', align: 'center' });
      const r = save.ranks[i];
      if (r) drawText(ctx, r, x + cw - 4, y + 2, { color: r === 'S' ? '#ffe040' : '#ff8aa0', align: 'right' });
      this.rects.push({ x, y, w: cw, h: ch });
    });
    const s = STAGES[this.sel];
    ctx.fillStyle = 'rgba(16,10,32,0.9)';
    ctx.fillRect(0, H - 38, W, 38);
    drawText(ctx, `${s.place} · ${s.time}`, 10, H - 35, { size: 8, color: '#9ad8ff' });
    drawText(ctx, this.sel > save.unlocked ? '通关前一关后解锁。' : s.blurb, 10, H - 24, { size: 12, color: '#ffffff' });
    drawText(ctx, `难度 ${DIFF_NAMES[save.settings.difficulty]}  最佳 ${pad(save.bestScores[this.sel] || 0)}`, W - 8, H - 35, { size: 8, color: '#c0b0e0', align: 'right' });
  }
}
