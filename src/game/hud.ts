// Arcade HUD: portraits, HP bars, meter, score, timer, combo, boss bar, cards.
import { W, H } from '../core/gfx';
import { drawText } from '../core/text';
import { save } from '../core/save';
import { HERO_PORTRAIT } from '../art/props';
import type { World } from './world';
import { METER_BAR } from './player';
import { input } from '../core/input';

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c = '#f0e8d0') {
  ctx.fillStyle = '#100818';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = c;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#100818';
  ctx.fillRect(x, y, w, h);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, lag: number, color: string, rtl = false) {
  frame(ctx, x, y, w, h);
  ctx.fillStyle = '#5a1018';
  ctx.fillRect(x, y, w, h);
  const lw = Math.round(w * Math.max(0, Math.min(1, lag)));
  const vw = Math.round(w * Math.max(0, Math.min(1, v)));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rtl ? x + w - lw : x, y, lw, h);
  ctx.fillStyle = color;
  ctx.fillRect(rtl ? x + w - vw : x, y, vw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(rtl ? x + w - vw : x, y, vw, 1);
}

export function pad(n: number, len = 7) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

export function drawHud(ctx: CanvasRenderingContext2D, w: World) {
  const p = w.player;
  const t = w.frames;
  // --- player panel
  frame(ctx, 6, 5, 22, 22, '#ffd040');
  ctx.drawImage(HERO_PORTRAIT, 6, 5);
  drawText(ctx, '阿龙', 32, 1, { color: '#ffffff' });
  drawText(ctx, `×${p.lives}`, 60, 4, { size: 8, color: '#ffe040' });
  const hpC = p.hp / p.maxHp < 0.3 ? (t % 20 < 10 ? '#ff4a3a' : '#ffb020') : '#ffd828';
  bar(ctx, 32, 15, 112, 5, p.hp / p.maxHp, p.displayHp / p.maxHp, hpC);
  // meter: 3 segments
  for (let i = 0; i < 3; i++) {
    const x = 32 + i * 38;
    const v = Math.max(0, Math.min(1, (p.meter - i * METER_BAR) / METER_BAR));
    frame(ctx, x, 24, 35, 3, '#6ad8ff');
    ctx.fillStyle = '#0a1a3a';
    ctx.fillRect(x, 24, 35, 3);
    ctx.fillStyle = v >= 1 ? (t % 30 < 15 ? '#9ae8ff' : '#3a9aff') : '#2a6ad0';
    ctx.fillRect(x, 24, Math.round(35 * v), 3);
  }
  drawText(ctx, '气', 148, 19, { color: '#6ad8ff' });
  // --- score
  drawText(ctx, `1P ${pad(w.session.score)}`, 160, 3, { size: 8, color: '#ffffff' });
  drawText(ctx, `HI ${pad(save.highScore)}`, 160, 12, { size: 8, color: '#ff8a8a' });
  // --- timer
  const tc = w.timer <= 10 && t % 30 < 15 ? '#ff4a3a' : '#ffe040';
  drawText(ctx, 'TIME', W / 2 + 22, 2, { size: 8, color: '#9ad8ff', align: 'center' });
  drawText(ctx, String(Math.max(0, w.timer)).padStart(2, '0'), W / 2 + 22, 9, { color: tc, align: 'center', scale: 2, thickOutline: true });
  // --- enemy info
  const ei = w.enemyInfo;
  if (ei && !ei.e.isBoss && ei.t > 0 && (ei.t > 40 || ei.t % 4 < 2)) {
    const e = ei.e;
    frame(ctx, W - 28, 5, 22, 22, '#ff6a5a');
    if (e.portrait) ctx.drawImage(e.portrait, W - 28, 5);
    drawText(ctx, e.name, W - 32, 1, { color: '#ffffff', align: 'right' });
    bar(ctx, W - 32 - 112, 15, 112, 5, Math.max(0, e.hp) / e.maxHp, Math.max(0, e.hp) / e.maxHp, '#ff8a2a', true);
  }
  // --- boss bar
  if (w.boss && !w.boss.dead && w.flow !== 'intro') {
    const b = w.boss;
    const bw = W - 120;
    const x = 60;
    const y = H - 14;
    frame(ctx, x - 26, y - 14, 22, 22, '#ff3a5a');
    if (b.portrait) ctx.drawImage(b.portrait, x - 26, y - 14);
    drawText(ctx, b.name, x, y - 14, { color: '#ffffff' });
    drawText(ctx, 'BOSS', x + bw, y - 12, { size: 8, color: '#ff3a5a', align: 'right' });
    bar(ctx, x, y, bw, 6, Math.max(0, b.hp) / b.maxHp, Math.max(0, b.hp) / b.maxHp, t % 60 < 30 || b.hp > b.maxHp * 0.3 ? '#ff4a6a' : '#ffb020');
  }
  // --- combo
  if (w.combo >= 2) {
    const k = w.comboT > 100 ? 1.5 : 1;
    drawText(ctx, `${w.combo}`, W - 34, 70, { color: '#ffe040', outline: '#6a1a00', scale: 2 * k >= 3 ? 3 : 2, align: 'right', thickOutline: true });
    drawText(ctx, 'HITS', W - 8, 74, { size: 8, color: '#ff8a3a', align: 'right' });
    drawText(ctx, '连击', W - 8, 84, { color: '#ffffff', align: 'right' });
  }
  // --- GO arrow
  if (w.goArrow > 0 && Math.floor(w.goArrow / 15) % 2 === 0 && !w.boss) {
    drawText(ctx, 'GO', W - 44, 110, { color: '#ffe040', outline: '#6a1a00', scale: 2, thickOutline: true });
    ctx.fillStyle = '#100818';
    ctx.beginPath();
    ctx.moveTo(W - 22, 104);
    ctx.lineTo(W - 6, 117);
    ctx.lineTo(W - 22, 130);
    ctx.fill();
    ctx.fillStyle = '#ffe040';
    ctx.beginPath();
    ctx.moveTo(W - 20, 108);
    ctx.lineTo(W - 9, 117);
    ctx.lineTo(W - 20, 126);
    ctx.fill();
  }
  // --- credits
  const cr = w.session.credits < 0 ? 'FREE PLAY' : `CREDIT ${w.session.credits}`;
  if (!w.boss) drawText(ctx, cr, 6, H - 11, { size: 8, color: '#c0c0d0' });
  // --- tutorial
  if (w.tutorial > 0 && w.flow === 'play') {
    const touch = input.lastDevice === 'touch' || document.body.classList.contains('touch');
    const lines = touch
      ? ['摇杆移动 · 拳/腿连打 · 跳 · 闪避', '长按「气」蓄力发波动拳 · 拳+腿=旋风腿']
      : ['方向键/WASD 移动 · J拳 K腿 L跳 U闪避 · 双击方向跑', 'I 能量拳 (长按蓄力) · J+K 旋风腿 · 骑手晕了按J抓住'];
    const a = Math.min(1, w.tutorial / 60);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    ctx.fillRect(40, H - 44, W - 80, 30);
    lines.forEach((l, i) => drawText(ctx, l, W / 2, H - 42 + i * 14, { size: 12, color: i ? '#9ad8ff' : '#ffffff', align: 'center' }));
    ctx.globalAlpha = 1;
  }
  // --- stage card
  if (w.flow === 'intro' || (w.flow === 'play' && w.flowT < 90 && !w.boss)) {
    const k = w.flow === 'intro' ? Math.min(1, w.flowT / 20) : Math.max(0, 1 - w.flowT / 90);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,6,20,0.75)';
    ctx.fillRect(0, 64, W, 76);
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(0, 64, W, 2);
    ctx.fillRect(0, 138, W, 2);
    const s = w.stage;
    const off = w.flow === 'intro' ? Math.max(0, 60 - w.flowT * 3) : 0;
    drawText(ctx, s.idx === 6 ? 'FINAL STAGE' : `STAGE ${s.idx + 1}`, W / 2 - off, 70, { size: 12, color: '#ffd040', align: 'center' });
    drawText(ctx, s.name, W / 2 + off, 86, { color: '#ffffff', gradient: ['#ffffff', '#ffe8a0', '#ffb040'], outline: '#401000', scale: 2, align: 'center', thickOutline: true });
    drawText(ctx, `${s.place}  ${s.time}`, W / 2, 120, { color: '#9ad8ff', align: 'center' });
    ctx.globalAlpha = 1;
  }
  // --- boss card
  if (w.bossCard > 0 && w.boss) {
    const k = w.bossCard > 130 ? (150 - w.bossCard) / 20 : w.bossCard < 20 ? w.bossCard / 20 : 1;
    ctx.globalAlpha = k;
    const y = 40;
    ctx.fillStyle = 'rgba(40,0,10,0.8)';
    ctx.fillRect(0, y, W, 50);
    ctx.fillStyle = '#ff3a5a';
    ctx.fillRect(0, y, W, 2);
    ctx.fillRect(0, y + 48, W, 2);
    if (t % 20 < 12) drawText(ctx, 'WARNING!! BOSS', W / 2, y + 4, { size: 8, color: '#ff3a5a', align: 'center' });
    drawText(ctx, w.boss.name, W / 2, y + 16, { color: '#ffffff', gradient: ['#ffffff', '#ffb0b0', '#ff3a5a'], outline: '#300008', scale: 2, align: 'center', thickOutline: true });
    ctx.globalAlpha = 1;
  }
}

export function drawContinue(ctx: CanvasRenderingContext2D, w: World, count: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, 'CONTINUE?', W / 2, 60, { color: '#ffe040', outline: '#6a1a00', scale: 3, align: 'center', thickOutline: true });
  drawText(ctx, String(count), W / 2, 104, { color: '#ffffff', outline: '#401010', scale: 4, align: 'center', thickOutline: true });
  const cr = w.session.credits;
  if (Math.floor(w.frames / 20) % 2 === 0) drawText(ctx, cr === 0 ? 'NO CREDIT…' : 'INSERT COIN — 按 开始/拳 续币', W / 2, 168, { color: '#ff8a8a', align: 'center' });
  drawText(ctx, cr < 0 ? 'FREE PLAY' : `CREDIT ${cr}`, W / 2, 188, { size: 8, color: '#c0c0d0', align: 'center' });
  drawText(ctx, '阿龙倒在了人行道上……但骑手们也只是在赶时间。', W / 2, 214, { size: 8, color: '#9ad8ff', align: 'center' });
}
