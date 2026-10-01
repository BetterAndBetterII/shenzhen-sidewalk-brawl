// Gameplay scene: wraps World, handles pause, continues, stage flow, autoplay bot.
import { app, Scene } from '../app';
import { audio } from '../core/audio';
import { H, W } from '../core/gfx';
import { Btn, BTNS, input } from '../core/input';
import { persist, save } from '../core/save';
import { drawText } from '../core/text';
import { Session, World } from '../game/world';
import { drawContinue, drawHud } from '../game/hud';
import { diff } from '../game/diff';
import { STAGES } from '../game/stages';
import { Menu } from './ui';
import { ResultsScene } from './results';
import { GameOverScene } from './results';
import { TitleScene } from './title';
import { Rider } from '../game/enemies';

export const params = new URLSearchParams(location.search);
export const DEBUG = { bot: params.has('bot'), god: params.has('god') };

export function newSession(stage: number): Session {
  const d = diff();
  return { score: 0, lives: d.lives, credits: d.credits, continues: 0, stage, totalHits: 0 };
}

export function startGame(stage: number, session?: Session) {
  const s = session || newSession(stage);
  s.stage = stage;
  app.go(new PlayScene(stage, s));
}

export class PlayScene implements Scene {
  name = 'play';
  showTouch = true;
  world: World;
  paused = false;
  pauseMenu: Menu;
  contCount = 9;
  contT = 0;
  botT = 0;
  constructor(
    public stageIdx: number,
    public session: Session,
  ) {
    this.world = new World(stageIdx, session);
    this.pauseMenu = new Menu(
      [
        { label: '继续游戏', action: () => (this.paused = false) },
        { label: '重新开始本关', action: () => app.go(new PlayScene(this.stageIdx, { ...this.session, score: this.world.stageStartScore, lives: diff().lives })) },
        {
          label: () => (save.settings.muted ? '声音：关' : '声音：开'),
          action: () => {
            save.settings.muted = !save.settings.muted;
            audio.setMuted(save.settings.muted);
            persist();
          },
        },
        { label: '返回标题', action: () => app.go(new TitleScene(true)) },
      ],
      W / 2,
      104,
      16,
      150,
    );
  }
  enter() {
    audio.playMusic(STAGES[this.stageIdx].music);
    (window as unknown as { __game: Record<string, unknown> }).__game.world = this.world;
  }
  leave() {
    input.bot = null;
  }
  update() {
    const w = this.world;
    if (DEBUG.bot) this.bot();
    if (this.paused) {
      this.pauseMenu.update();
      if (input.pressed('back')) this.paused = false;
      return;
    }
    if (w.flow === 'continue') {
      this.contT++;
      if (this.contT > 70 && this.contT % 60 === 0) {
        this.contCount--;
        audio.sfx('beep');
      }
      const credits = this.session.credits;
      if (this.contT > 40 && (input.pressed('start') || input.pressed('punch') || input.clicks.length)) {
        if (credits !== 0) {
          audio.sfx('coin');
          w.continueGame();
          this.contCount = 9;
          this.contT = 0;
        } else {
          app.go(new GameOverScene(this.session));
        }
      }
      if (this.contCount < 0 || (credits === 0 && this.contT > 200)) app.go(new GameOverScene(this.session));
      w.update();
      return;
    }
    if ((input.pressed('start') || input.pressed('back')) && w.flow !== 'done') {
      this.paused = true;
      this.pauseMenu.sel = 0;
      audio.sfx('menu');
      return;
    }
    w.update();
    if (DEBUG.god) {
      w.player.hp = w.player.maxHp;
      w.timer = 99;
    }
    if (w.events.includes('clear')) {
      w.events.length = 0;
      app.go(new ResultsScene(w));
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const w = this.world;
    w.draw(ctx);
    drawHud(ctx, w);
    if (w.flow === 'continue') drawContinue(ctx, w, Math.max(0, this.contCount));
    if (w.flow === 'clear') {
      const k = Math.min(1, w.flowT / 20);
      drawText(ctx, 'STAGE CLEAR!', W / 2, 90 - (1 - k) * 40, { color: '#ffe040', gradient: ['#ffffff', '#ffe040', '#ff9a20'], outline: '#5a1a00', scale: 3, align: 'center', thickOutline: true });
      if (w.flowT > 40) drawText(ctx, '人行道恢复了秩序', W / 2, 136, { color: '#ffffff', align: 'center' });
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(5,3,10,0.6)';
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'PAUSE', W / 2, 66, { color: '#ffd040', scale: 2, align: 'center', thickOutline: true });
      this.pauseMenu.draw(ctx);
      drawText(ctx, 'J拳 K腿 L跳 U闪避 I气功(长按蓄力) · 双击方向跑 · J+K旋风腿', W / 2, H - 20, { size: 8, color: '#9ad8ff', align: 'center' });
    }
  }

  /** Simple autoplay used for automated testing (?bot=1). */
  bot() {
    const w = this.world;
    const p = w.player;
    this.botT++;
    const b = {} as Record<Btn, boolean>;
    for (const k of BTNS) b[k] = false;
    input.bot = b;
    if (w.flow === 'continue') {
      if (this.botT % 30 === 0) b.start = true;
      return;
    }
    let target = null as null | { x: number; z: number; isBoss: boolean; hw: number; y: number };
    let best = 1e9;
    for (const e of w.enemies) {
      if (!e.canBeHit()) continue;
      if (e.x < w.camX - 10 || e.x > w.camX + W + 10) continue;
      const d = Math.abs(e.x - p.x) + Math.abs(e.z - p.z) * 2;
      if (d < best) {
        best = d;
        target = e;
      }
    }
    if (!target) {
      b.right = true;
      return;
    }
    const algo = target.isBoss && !(target instanceof Rider);
    const desiredZ = algo ? target.z + 2 : target.z;
    const side = p.x < target.x ? -1 : 1;
    const desiredX = target.x + side * (algo ? 20 : target.hw + 12);
    const dx = desiredX - p.x;
    const dz = desiredZ - p.z;
    if (Math.abs(dx) > 4) b[dx > 0 ? 'right' : 'left'] = true;
    if (Math.abs(dz) > 3) b[dz > 0 ? 'down' : 'up'] = true;
    if (Math.abs(dx) < 14 && Math.abs(dz) < 6) {
      if (p.face !== -side) b[-side > 0 ? 'right' : 'left'] = true;
      if (p.meter >= 100 && this.botT % 90 === 0) b.special = true;
      else if (this.botT % 8 < 2) b.punch = true;
      else if (this.botT % 40 === 20) b.kick = true;
    }
  }
}
