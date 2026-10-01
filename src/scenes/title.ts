// Title screen + main menu.
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { drawSprite, H, W } from '../core/gfx';
import { input } from '../core/input';
import { DIFF_NAMES, save } from '../core/save';
import { drawText } from '../core/text';
import { Backdrop, drawBackdrop, makeBackdrop } from '../art/backgrounds';
import { HERO_POSES, HERO_STYLE, HeroSprite, renderPose } from '../art/hero';
import { BRANDS, riderSprite, RiderSprite } from '../art/riders';
import { banner, logo, Menu, speedLines } from './ui';
import { StageSelectScene } from './select';
import { OptionsScene } from './options';
import { HowToScene } from './howto';
import { StoryScene } from './story';
import { pad } from '../game/hud';

export const REPO = 'https://github.com/BetterAndBetterII/shenzhen-sidewalk-brawl';

let bd: Backdrop | null = null;
let heroBig: HeroSprite | null = null;
let riderL: RiderSprite | null = null;
let riderR: RiderSprite | null = null;

export class TitleScene implements Scene {
  name = 'title';
  showLinks = true;
  t = 0;
  stage: 'coin' | 'menu' = 'coin';
  menu: Menu;
  cam = 0;
  constructor(skipCoin = false) {
    if (!bd) bd = makeBackdrop('cv', 4000);
    if (!heroBig) heroBig = renderPose({ ...HERO_POSES.efist[1], tail: 2 }, { ...HERO_STYLE, scale: 2 }, 200, 170, 100, 160);
    if (!riderL) riderL = riderSprite(BRANDS.elema, 'scooter', 'lean', 0, 2);
    if (!riderR) riderR = riderSprite(BRANDS.meican, 'scooter', 'honk', 1, 2);
    if (skipCoin) this.stage = 'menu';
    this.menu = new Menu(
      [
        { label: '开始游戏', hint: '从第一关开始（含开场剧情）', action: () => app.go(new StoryScene('intro', 0)) },
        { label: '选择关卡', hint: `已解锁 ${save.unlocked + 1} / 7 关`, action: () => app.go(new StageSelectScene()) },
        { label: '游戏设置', hint: '难度 · CRT扫描线 · 音量 · 震屏', action: () => app.go(new OptionsScene()) },
        { label: '操作说明', hint: '键盘 / 手柄 / 触屏', action: () => app.go(new HowToScene()) },
        { label: '⭐ GitHub 开源', hint: 'github.com/BetterAndBetterII/shenzhen-sidewalk-brawl', action: () => window.open(REPO, '_blank', 'noopener') },
      ],
      W / 2,
      138,
      15,
      150,
    );
  }
  enter() {
    if (audio.ctx) audio.playMusic('title');
  }
  update() {
    this.t++;
    this.cam += 0.6;
    if (this.stage === 'coin') {
      if (input.anyKeyPressed || input.clicks.length) {
        audio.init();
        audio.sfx('coin');
        audio.playMusic('title');
        this.stage = 'menu';
        input.clicks.length = 0;
      }
    } else {
      this.menu.update();
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = this.t;
    drawBackdrop(ctx, bd!, this.cam % 3000);
    ctx.fillStyle = 'rgba(16,6,40,0.55)';
    ctx.fillRect(0, 0, W, H);
    // sunburst
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.rotate(t * 0.002);
    ctx.fillStyle = 'rgba(255,200,80,0.07)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(400, -60);
      ctx.lineTo(400, 60);
      ctx.fill();
    }
    ctx.restore();
    speedLines(ctx, t);
    // characters
    const wob = Math.sin(t * 0.1) * 2;
    drawSprite(ctx, riderL!, 70 + Math.sin(t * 0.05) * 6, 236 + wob, false);
    drawSprite(ctx, riderR!, 410 - Math.sin(t * 0.05) * 6, 232 - wob, true);
    // hero with glowing fist
    const hx = 228;
    const hy = 250;
    drawSprite(ctx, heroBig!, hx, hy, false);
    const f = heroBig!.fist;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i >= 1; i--) {
      ctx.fillStyle = i === 1 ? 'rgba(230,250,255,0.95)' : `rgba(${60 + i * 10},${150 + i * 10},255,${0.18 + 0.08 * (4 - i)})`;
      ctx.beginPath();
      ctx.arc(hx + f[0], hy + f[1], i * 6 + Math.sin(t * 0.3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // logo
    logo(ctx, W / 2, 16, t, 3);
    drawText(ctx, 'SHENZHEN  SIDEWALK  BRAWL', W / 2, 62, { size: 8, color: '#ffffff', outline: '#100818', align: 'center' });
    drawText(ctx, `HI-SCORE ${pad(save.highScore)}`, W / 2, 74, { size: 8, color: '#ff8a8a', align: 'center' });
    banner(ctx, '是算法的问题  不是他们的错！', H - 22);
    if (this.stage === 'coin') {
      if (Math.floor(t / 30) % 2 === 0) drawText(ctx, 'INSERT COIN', W / 2, 112, { color: '#ffe040', outline: '#6a1a00', scale: 2, align: 'center', thickOutline: true });
      drawText(ctx, '按任意键 / 点击屏幕 投币', W / 2, 146, { size: 12, color: '#ffffff', align: 'center' });
      drawText(ctx, 'v1.0 · 2026 · 原创像素 · 纯属虚构', 6, H - 34, { size: 8, color: '#a090c0' });
    } else {
      this.menu.draw(ctx);
      drawText(ctx, `难度：${DIFF_NAMES[save.settings.difficulty]}`, 6, H - 34, { size: 8, color: '#a090c0' });
    }
  }
}
