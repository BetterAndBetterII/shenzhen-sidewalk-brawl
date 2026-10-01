// Controls & tips.
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { drawSprite, H, W } from '../core/gfx';
import { input } from '../core/input';
import { drawText } from '../core/text';
import { HERO } from '../art/hero';
import { panel, speedLines } from './ui';
import { TitleScene } from './title';

export class HowToScene implements Scene {
  name = 'howto';
  t = 0;
  page = 0;
  update() {
    this.t++;
    if (input.pressed('right') || input.pressed('punch') || input.clicks.length) {
      this.page++;
      audio.sfx('menu');
      if (this.page > 1) app.go(new TitleScene(true));
    }
    if (input.pressed('left')) this.page = Math.max(0, this.page - 1);
    if (input.pressed('back') || input.pressed('kick')) {
      audio.sfx('back');
      app.go(new TitleScene(true));
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120a24';
    ctx.fillRect(0, 0, W, H);
    speedLines(ctx, this.t, 'rgba(120,90,200,0.15)');
    drawText(ctx, this.page === 0 ? '操作说明' : '街头生存指南', W / 2, 6, { color: '#ffd040', scale: 2, align: 'center', thickOutline: true });
    panel(ctx, 14, 36, W - 28, H - 64);
    if (this.page === 0) {
      const rows: [string, string, string][] = [
        ['移动', '方向键 / WASD', '摇杆'],
        ['奔跑', '双击 ← / →', '快速推两下'],
        ['拳 (连打 3 段)', 'J / Z', '拳'],
        ['腿 (终结/跑步飞踢)', 'K / X', '腿'],
        ['跳跃 (空中可拳/腿)', 'L / Space / C', '跳'],
        ['闪避翻滚 (无敌)', 'U / Shift', '闪'],
        ['能量拳 · 长按蓄力波动拳', 'I / V', '气'],
        ['旋风腿 (耗血解围)', 'J + K 同时', '拳+腿'],
        ['抓住眩晕骑手 → 摔', '靠近按 J → K 或 方向+J', ''],
        ['暂停 / 静音 / 全屏', 'Enter·Esc / M / F', 'II'],
      ];
      drawText(ctx, '动作', 26, 40, { size: 8, color: '#9ad8ff' });
      drawText(ctx, '键盘', 210, 40, { size: 8, color: '#9ad8ff' });
      drawText(ctx, '触屏', 380, 40, { size: 8, color: '#9ad8ff' });
      rows.forEach((r, i) => {
        const y = 53 + i * 15;
        drawText(ctx, r[0], 26, y, { color: '#ffffff' });
        drawText(ctx, r[1], 210, y, { color: '#ffe040' });
        drawText(ctx, r[2], 380, y, { color: '#7aff7a' });
      });
      drawText(ctx, '手柄：A跳 X拳 Y腿 B/LB闪避 RB/RT气 Start暂停', W / 2, 210, { size: 8, color: '#c0b0e0', align: 'center' });
    } else {
      const tips = [
        '骑手高速冲来时出拳 = COUNTER！伤害×1.5 并逼停对方。',
        '被撞前一瞬翻滚 = 完美闪避：子弹时间 + 回气。',
        '跳起来可以越过电驴！Boss 的冲击波也要跳过去。',
        '把骑手打晕后按 J 抓住，再按 K 连人带车过肩摔。',
        '把骑手引到没盖的井盖上……他会掉坑（不疼的）。',
        '气槽满 3 格时长按「气」：人行道正义拳，清屏！',
        '烤肠/热玉米/肠粉回血，奶茶回气，红包加分，电池加命。',
        '雨伞骑手挡得住正面拳头：用腿、跳踢或绕到背后。',
        '打败骑手不是目的——让他们慢下来、平安送达才是。',
      ];
      tips.forEach((t, i) => drawText(ctx, '· ' + t, 26, 46 + i * 18, { color: i === 8 ? '#ffd040' : '#ffffff' }));
      drawSprite(ctx, HERO.victory[Math.floor(this.t / 12) % 2], W - 40, H - 34);
    }
    drawText(ctx, `${this.page + 1}/2  → 下一页 · K/Esc 返回`, W / 2, H - 12, { size: 8, color: '#8a80a0', align: 'center' });
  }
}
