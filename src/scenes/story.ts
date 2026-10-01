// Story cutscenes: opening and ending.
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { drawSprite, drawSpriteRot, H, W } from '../core/gfx';
import { input } from '../core/input';
import { drawText, wrapText } from '../core/text';
import { Backdrop, drawBackdrop, makeBackdrop } from '../art/backgrounds';
import { HERO, HERO_POSES, HERO_STYLE, HeroSprite, renderPose } from '../art/hero';
import { BRANDS, riderBody, RIDER_POSES, riderSprite } from '../art/riders';
import { banner, logo, panel, speedLines } from './ui';
import { startGame } from './play';
import { TitleScene, REPO } from './title';

interface Panel {
  text: string;
  speaker?: string;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
}

const bds: Record<string, Backdrop> = {};
function bd(id: string) {
  if (!bds[id]) bds[id] = makeBackdrop(id, 2400);
  return bds[id];
}
let heroFist: HeroSprite | null = null;

export class StoryScene implements Scene {
  name = 'story';
  panels: Panel[];
  i = 0;
  t = 0;
  chars = 0;
  done = false;
  constructor(
    public kind: 'intro' | 'ending',
    public stage = 0,
  ) {
    if (!heroFist) heroFist = renderPose({ ...HERO_POSES.efist[1], tail: 3 }, { ...HERO_STYLE, scale: 2 }, 200, 170, 100, 160);
    this.panels = kind === 'intro' ? this.introPanels() : this.endingPanels();
    this.showLinks = kind === 'ending';
  }
  showLinks = false;
  enter() {
    audio.playMusic(this.kind === 'intro' ? 'intro' : 'ending');
  }

  introPanels(): Panel[] {
    return [
      {
        text: '深圳，龙华。早上 8:47。\n阿龙只想走路去上班。',
        draw: (ctx, t) => {
          drawBackdrop(ctx, bd('cv'), 200 + t * 0.5);
          drawSprite(ctx, HERO.walk[Math.floor(t / 6) % 8], 150 + Math.min(80, t * 0.6), 205);
        },
      },
      {
        text: '可是人行道上——\n“嘀嘀！让一让！”电驴呼啸而过。',
        draw: (ctx, t) => {
          drawBackdrop(ctx, bd('cv'), 300);
          speedLines(ctx, t * 2, 'rgba(255,255,255,0.4)');
          const brands = [BRANDS.meican, BRANDS.elema, BRANDS.lvye, BRANDS.shan];
          brands.forEach((b, k) => {
            const x = ((t * (4 + k) + k * 160) % (W + 160)) - 80;
            drawSprite(ctx, riderSprite(b, k === 3 ? 'sport' : 'scooter', 'lean', Math.floor(t / 3) % 3), k % 2 ? W - x : x, 170 + k * 18, k % 2 === 1);
          });
          drawSprite(ctx, HERO.hurt[0], 240, 200);
          if (t % 40 < 20) drawText(ctx, '嘀嘀!!', 300, 100, { color: '#ffe040', scale: 2, thickOutline: true });
        },
      },
      {
        text: '但骑手们也不想这样。\n超时扣钱，差评罚款，系统还在不停地派单。',
        draw: (ctx, t) => {
          ctx.fillStyle = '#1a1030';
          ctx.fillRect(0, 0, W, H);
          speedLines(ctx, t, 'rgba(120,90,200,0.25)');
          const r = riderSprite(BRANDS.meican, 'scooter', 'phone', 0, 2);
          drawSprite(ctx, r, 200, 230);
          // phone UI
          panel(ctx, 300, 40, 130, 110, '#3a3a50');
          drawText(ctx, '新订单 ×3', 365, 46, { color: '#ffe040', align: 'center' });
          drawText(ctx, `剩余 00:${String(Math.max(0, 47 - Math.floor(t / 10))).padStart(2, '0')}`, 365, 66, { color: t % 30 < 15 ? '#ff4a4a' : '#ffffff', align: 'center', scale: 1 });
          drawText(ctx, '超时扣款 -¥5', 365, 86, { size: 8, color: '#ff8a8a', align: 'center' });
          drawText(ctx, '差评罚款 -¥50', 365, 100, { size: 8, color: '#ff8a8a', align: 'center' });
          drawText(ctx, '系统推荐路线：', 365, 116, { size: 8, color: '#9ad8ff', align: 'center' });
          drawText(ctx, '人行道（最快）', 365, 128, { size: 8, color: '#ffffff', align: 'center' });
        },
      },
      {
        text: '在这一切背后，\n有一个看不见的东西……',
        draw: (ctx, t) => {
          ctx.fillStyle = '#05010c';
          ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < 40; i++) {
            const x = (i * 97 + t) % W;
            const y = (i * 53) % 200;
            drawText(ctx, '#' + ((i * 7919 + Math.floor(t / 20)) % 9999), x, y, { size: 8, color: '#3a1a5a', outline: null });
          }
          const open = Math.min(1, t / 60);
          ctx.fillStyle = '#ff2a4a';
          const eh = Math.round(12 * open);
          ctx.fillRect(170, 100 - eh / 2, 40, eh);
          ctx.fillRect(270, 100 - eh / 2, 40, eh);
          if (open >= 1) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(184, 96, 8, 8);
            ctx.fillRect(284, 96, 8, 8);
          }
          if (t > 70) drawText(ctx, '派单算法 ALGO-9000', W / 2, 140, { color: '#ff3a6a', align: 'center' });
        },
      },
      {
        text: '是算法的问题，不是他们的错！',
        draw: (ctx, t) => {
          ctx.fillStyle = '#120820';
          ctx.fillRect(0, 0, W, H);
          speedLines(ctx, t * 2, 'rgba(255,200,80,0.2)');
          logo(ctx, W / 2, 40, t, 3);
          banner(ctx, '是算法的问题  不是他们的错！', 120);
        },
      },
      {
        text: '今天，阿龙决定——\n用拳头，让大家都慢下来。',
        speaker: '阿龙',
        draw: (ctx, t) => {
          drawBackdrop(ctx, bd('cv'), 500);
          ctx.fillStyle = 'rgba(10,0,30,0.5)';
          ctx.fillRect(0, 0, W, H);
          speedLines(ctx, t, 'rgba(120,200,255,0.3)');
          const hx = 200;
          const hy = 250;
          drawSprite(ctx, heroFist!, hx, hy);
          const f = heroFist!.fist;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 4; i >= 1; i--) {
            ctx.fillStyle = i === 1 ? 'rgba(230,250,255,0.95)' : `rgba(60,170,255,${0.15 + 0.08 * (4 - i)})`;
            ctx.beginPath();
            ctx.arc(hx + f[0], hy + f[1], i * 6 + Math.sin(t * 0.3) * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        },
      },
    ];
  }

  endingPanels(): Panel[] {
    const riders = [BRANDS.meican, BRANDS.elema, BRANDS.lvye, BRANDS.shan, BRANDS.shunfeng];
    return [
      {
        text: '系统重启中……\n派单算法 ALGO-9000 已下线。',
        draw: (ctx, t) => {
          ctx.fillStyle = t % 8 < 4 && t < 60 ? '#ffffff' : '#0a0418';
          ctx.fillRect(0, 0, W, H);
          const p = Math.min(100, Math.floor(t / 1.2));
          panel(ctx, 140, 110, 200, 40, '#9a6aff');
          drawText(ctx, `REBOOT ${p}%`, W / 2, 116, { color: '#c08aff', align: 'center' });
          ctx.fillStyle = '#c08aff';
          ctx.fillRect(150, 136, Math.round(180 * (p / 100)), 6);
        },
      },
      {
        text: '骑手们的头盔不再闪着红光。\n他们第一次，慢慢地停了下来。',
        draw: (ctx, t) => {
          drawBackdrop(ctx, bd('tech'), 600);
          riders.forEach((b, k) => {
            const pose = (Math.floor(t / 20) + k) % 2 ? RIDER_POSES.wave : RIDER_POSES.stand;
            drawSprite(ctx, riderBody(b, pose), 90 + k * 70, 200 + (k % 2) * 14);
          });
          drawSprite(ctx, HERO.victory[Math.floor(t / 12) % 2], 420, 210);
        },
      },
      {
        text: '新规则上线：配送时限 +15 分钟，\n超时不扣钱，人行道还给行人。',
        draw: (ctx, t) => {
          ctx.fillStyle = '#10203a';
          ctx.fillRect(0, 0, W, H);
          panel(ctx, 90, 40, 300, 150, '#3ad05a');
          drawText(ctx, '《配送新规》', W / 2, 50, { color: '#7aff7a', align: 'center', scale: 2 });
          const lines = ['① 配送时限 +15 分钟', '② 超时不扣钱，恶劣天气加价', '③ 电动车请走非机动车道', '④ 算法须保留“人”的余量', '⑤ 行人与骑手互相礼让'];
          lines.forEach((l, i) => {
            if (t > 20 + i * 25) drawText(ctx, l, 110, 82 + i * 20, { color: '#ffffff' });
          });
        },
      },
      {
        text: '阿龙：……不过今天，\n我又迟到了。',
        speaker: '阿龙',
        draw: (ctx, t) => {
          drawBackdrop(ctx, bd('metro'), 300);
          ctx.fillStyle = 'rgba(255,120,60,0.18)';
          ctx.fillRect(0, 0, W, H);
          const x = 120 + Math.min(200, t * 0.8);
          drawSprite(ctx, riderSprite(BRANDS.meican, 'scooter', 'ride', Math.floor(t / 6) % 3), x - 60, 214);
          drawSprite(ctx, HERO.walk[Math.floor(t / 6) % 8], x, 200);
          drawText(ctx, '慢点骑～', x - 60, 150, { size: 8, color: '#ffffff' });
        },
      },
      {
        text: 'THANK YOU FOR PLAYING!\n是算法的问题，不是他们的错。',
        draw: (ctx, t) => {
          ctx.fillStyle = '#120820';
          ctx.fillRect(0, 0, W, H);
          speedLines(ctx, t, 'rgba(255,200,80,0.15)');
          logo(ctx, W / 2, 30, t, 3);
          const cr = ['游戏设计 / 程序 / 像素 / 音乐：全部原创', '灵感来自一段“住龙华的每日心路历程”短视频', '字体：Fusion Pixel Font (OFL-1.1)', '平台名称均为虚构，如有雷同纯属巧合', '⭐ ' + REPO.replace('https://', '')];
          cr.forEach((l, i) => drawText(ctx, l, W / 2, 86 + i * 16, { size: i === 4 ? 8 : 12, color: i === 4 ? '#ffd040' : '#ffffff', align: 'center' }));
        },
      },
    ];
  }

  update() {
    this.t++;
    const p = this.panels[this.i];
    if (this.t % 2 === 0 && this.chars < p.text.length) {
      this.chars++;
      if (p.text[this.chars - 1] !== '\n' && this.chars % 2 === 0) audio.sfx('type');
    }
    const adv = input.pressed('punch') || input.pressed('jump') || input.pressed('kick') || input.clicks.length > 0;
    if (input.pressed('start') || input.pressed('back')) {
      this.finish();
      return;
    }
    if (adv) {
      if (this.chars < p.text.length) this.chars = p.text.length;
      else this.nextPanel();
    }
    if (this.chars >= p.text.length && this.t > p.text.length * 2 + 200) this.nextPanel();
  }
  nextPanel() {
    this.i++;
    this.t = 0;
    this.chars = 0;
    if (this.i >= this.panels.length) {
      this.i = this.panels.length - 1;
      this.finish();
    }
  }
  finish() {
    if (this.done) return;
    this.done = true;
    audio.sfx('select');
    if (this.kind === 'intro') startGame(this.stage);
    else app.go(new TitleScene(true));
  }
  draw(ctx: CanvasRenderingContext2D) {
    const p = this.panels[this.i];
    p.draw(ctx, this.t);
    // letterbox + dialog box
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, W, 14);
    const by = H - 62;
    panel(ctx, 16, by, W - 32, 50, '#ffd040');
    if (p.speaker) drawText(ctx, p.speaker, 26, by - 12, { color: '#ffd040' });
    const shown = p.text.slice(0, this.chars);
    const lines = shown.split('\n').flatMap((l) => wrapText(l, W - 56));
    lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, 28, by + 6 + i * 15, { color: '#ffffff' }));
    if (this.chars >= p.text.length && Math.floor(this.t / 20) % 2 === 0) drawText(ctx, '▼', W - 34, by + 36, { color: '#ffd040' });
    drawText(ctx, 'J/点击 继续   Enter 跳过', W - 8, 3, { size: 8, color: '#8a80a0', align: 'right' });
    void drawSpriteRot;
  }
}
