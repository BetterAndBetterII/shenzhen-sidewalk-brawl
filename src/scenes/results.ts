// Stage clear tally + rank, and the arcade GAME OVER screen.
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { drawSprite, H, W } from '../core/gfx';
import { input } from '../core/input';
import { persist, recordStage, save } from '../core/save';
import { drawText } from '../core/text';
import { HERO } from '../art/hero';
import type { World } from '../game/world';
import { pad } from '../game/hud';
import { STAGES } from '../game/stages';
import { startGame } from './play';
import { StoryScene } from './story';
import { panel, speedLines } from './ui';

export class ResultsScene implements Scene {
  name = 'results';
  t = 0;
  lines: { label: string; value: number; bonus: number }[];
  rank: string;
  shown = 0;
  total = 0;
  constructor(public w: World) {
    const p = w.player;
    const timeBonus = w.timer * 100;
    const hpBonus = Math.round(p.hp) * 50;
    const comboBonus = w.maxCombo * 150;
    const calmBonus = w.calmed * 200;
    this.lines = [
      { label: '剩余时间', value: w.timer, bonus: timeBonus },
      { label: '剩余体力', value: Math.round(p.hp), bonus: hpBonus },
      { label: '最高连击', value: w.maxCombo, bonus: comboBonus },
      { label: '平稳送达骑手', value: w.calmed, bonus: calmBonus },
    ];
    this.total = timeBonus + hpBonus + comboBonus + calmBonus;
    let pts = 0;
    const hits = p.stats.hitsTaken;
    pts += hits <= 2 ? 3 : hits <= 5 ? 2 : hits <= 9 ? 1 : 0;
    pts += w.maxCombo >= 20 ? 2 : w.maxCombo >= 10 ? 1 : 0;
    pts += w.session.continues === 0 ? 1 : 0;
    pts += p.lives >= 3 ? 1 : 0;
    this.rank = pts >= 6 ? 'S' : pts >= 4 ? 'A' : pts >= 3 ? 'B' : pts >= 1 ? 'C' : 'D';
    w.addScore(this.total);
    const idx = w.stage.idx;
    save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length - 1, idx + 1));
    if (idx === STAGES.length - 1) save.cleared = true;
    recordStage(idx, this.rank, w.session.score - w.stageStartScore);
    persist();
  }
  update() {
    this.t++;
    if (this.t % 30 === 0 && this.shown < this.lines.length + 1) {
      this.shown++;
      audio.sfx(this.shown > this.lines.length ? 'hitHeavy' : 'coin');
    }
    if (this.t > 30 && (input.confirm() || input.clicks.length)) {
      if (this.shown <= this.lines.length) {
        this.shown = this.lines.length + 1;
        return;
      }
      const s = this.w.session;
      const next = this.w.stage.idx + 1;
      s.lives = this.w.player.lives;
      if (next >= STAGES.length) app.go(new StoryScene('ending'));
      else startGame(next, s);
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120a24';
    ctx.fillRect(0, 0, W, H);
    speedLines(ctx, this.t, 'rgba(255,208,64,0.12)');
    drawText(ctx, `STAGE ${this.w.stage.idx + 1} CLEAR`, W / 2, 14, { color: '#ffe040', gradient: ['#ffffff', '#ffe040', '#ff9a20'], outline: '#5a1a00', scale: 2, align: 'center', thickOutline: true });
    drawText(ctx, this.w.stage.name, W / 2, 46, { color: '#9ad8ff', align: 'center' });
    panel(ctx, 40, 66, 270, 150);
    this.lines.forEach((l, i) => {
      if (i >= this.shown) return;
      const y = 76 + i * 22;
      drawText(ctx, l.label, 54, y, { color: '#ffffff' });
      drawText(ctx, String(l.value), 200, y, { color: '#ffd040', align: 'right' });
      drawText(ctx, `+${l.bonus}`, 296, y, { color: '#7aff7a', align: 'right' });
    });
    if (this.shown > this.lines.length) {
      drawText(ctx, '奖励合计', 54, 170, { color: '#ffffff' });
      drawText(ctx, `+${this.total}`, 296, 170, { color: '#7aff7a', align: 'right' });
      drawText(ctx, `SCORE ${pad(this.w.session.score)}`, 175, 192, { color: '#ffe040', align: 'center' });
      const k = Math.max(1, 4 - (this.t - (this.lines.length + 1) * 30) * 0.2);
      drawText(ctx, 'RANK', 380, 70, { color: '#ffffff', align: 'center' });
      const rc = { S: ['#ffffff', '#ffe040', '#ff8a20'], A: ['#ffffff', '#ff8aa0', '#ff3a5a'], B: ['#ffffff', '#9ad8ff', '#3a8aff'], C: ['#ffffff', '#9aff9a', '#3aa03a'], D: ['#ffffff', '#c0c0c0', '#808080'] }[this.rank]!;
      drawText(ctx, this.rank, 380, 92 - (k - 1) * 10, { gradient: rc, outline: '#100818', scale: Math.round(k * 4) / 2 + 3, align: 'center', thickOutline: true });
      const prev = save.ranks[this.w.stage.idx];
      if (prev) drawText(ctx, `最佳 ${prev}`, 380, 160, { size: 8, color: '#c0b0e0', align: 'center' });
      drawSprite(ctx, HERO.victory[Math.floor(this.t / 12) % 2], 380, 240);
      if (Math.floor(this.t / 25) % 2 === 0) drawText(ctx, this.w.stage.idx + 1 >= STAGES.length ? '按 J 观看结局' : '按 J 前往下一关', W / 2, H - 18, { color: '#ffffff', align: 'center' });
    }
  }
}

export class GameOverScene implements Scene {
  name = 'gameover';
  showLinks = true;
  t = 0;
  constructor(
    public session: { score: number; stage?: number },
    public world: World | null = null,
  ) {
    persist();
  }
  enter() {
    audio.playMusic('gameover');
  }
  update() {
    this.t++;
    if (this.t < 0) return;
    if (this.t > 50 && (input.pressed('start') || input.pressed('punch') || input.clicks.length)) {
      // TRY AGAIN? — insert a coin and retry this stage from scratch
      audio.sfx('coin');
      this.t = -9999;
      startGame(this.world ? this.world.stage.idx : this.session.stage ?? 0);
      return;
    }
    if ((this.t > 50 && (input.pressed('back') || input.pressed('kick'))) || this.t > 60 * 15) {
      audio.sfx('back');
      this.t = -9999;
      import('./title').then((m) => app.go(new m.TitleScene(true)));
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.max(0, this.t);
    if (this.world) {
      this.world.draw(ctx);
      ctx.fillStyle = 'rgba(8,4,14,0.72)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#08040e';
      ctx.fillRect(0, 0, W, H);
    }
    // neon sign like the arcade cabinet
    const colors = ['#ff4ad8', '#3aff7a', '#ffe040', '#4a9aff'];
    const c = colors[Math.floor(t / 24) % colors.length];
    const flick = t < 40 ? t % 6 < 3 : t % 97 < 3;
    const bx = 110;
    const by = 54;
    const bw = W - 220;
    const bh = 96;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = flick ? '#3a3050' : c;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
    if (!flick) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    drawText(ctx, 'GAME OVER', W / 2, by + 14, { color: flick ? '#3a3050' : c, outline: '#100818', scale: 3, align: 'center', thickOutline: true });
    drawText(ctx, 'TRY AGAIN?  INSERT COIN', W / 2, by + 58, { size: 8, color: '#9ad8ff', align: 'center' });
    drawText(ctx, '谢谢游玩', W / 2 + 88, by + 72, { size: 8, color: '#ff6ad8', align: 'center' });
    drawText(ctx, `SCORE ${pad(this.session.score)}`, W / 2, 160, { color: '#ffffff', align: 'center' });
    drawText(ctx, `HI-SCORE ${pad(save.highScore)}`, W / 2, 176, { size: 8, color: '#ff8a8a', align: 'center' });
    if (!this.world) drawSprite(ctx, HERO.down[0], W / 2, 214);
    if (Math.floor(t / 30) % 2 === 0) drawText(ctx, 'J / 点击：投币重来本关', W / 2, H - 40, { color: '#ffe040', align: 'center' });
    drawText(ctx, 'K / Esc：返回标题', W / 2, H - 22, { size: 8, color: '#a090c0', align: 'center' });
  }
}
