// App shell: scene manager, fixed-timestep loop, canvas scaling, overlays.
import { H, W } from './core/gfx';
import { input } from './core/input';
import { audio } from './core/audio';
import { save, persist } from './core/save';

export interface Scene {
  update(): void;
  draw(ctx: CanvasRenderingContext2D): void;
  enter?(): void;
  leave?(): void;
  showLinks?: boolean;
  showTouch?: boolean;
  name?: string;
}

class App {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  scene: Scene | null = null;
  next: Scene | null = null;
  fade = 0; // 0..1
  fadeDir = 0;
  acc = 0;
  last = 0;
  scale = 1;
  speed = 1; // debug fast-forward
  frame = 0;
  paused = false;

  init() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    this.canvas.addEventListener('pointerdown', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      input.clicks.push({ x, y });
      input.gesture();
      if (e.pointerType === 'touch') input.lastDevice = 'touch';
      input.anyKeyPressed = true;
    });
    input.onFirstGesture = () => audio.init();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && audio.ctx) audio.ctx.suspend();
      else if (audio.ctx) audio.ctx.resume();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        save.settings.muted = !save.settings.muted;
        audio.setMuted(save.settings.muted);
        persist();
      }
      if (e.code === 'KeyF' && !e.repeat) toggleFullscreen();
    });
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const si = Math.floor(s);
    const scale = si >= 2 && si / s > 0.88 ? si : s;
    this.scale = scale;
    const cw = Math.floor(W * scale);
    const ch = Math.floor(H * scale);
    const wrap = document.getElementById('wrap')!;
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    wrap.style.left = Math.floor((vw - cw) / 2) + 'px';
    wrap.style.top = Math.floor((vh - ch) / 2) + 'px';
    const crt = document.getElementById('crt')!;
    crt.style.backgroundSize = `100% ${Math.max(2, Math.round(scale))}px, 100% 100%`;
  }

  go(s: Scene, instant = false) {
    if (instant || !this.scene) {
      this.scene?.leave?.();
      this.scene = s;
      s.enter?.();
      this.updateOverlays();
      return;
    }
    this.next = s;
    this.fadeDir = 1;
  }

  updateOverlays() {
    const s = this.scene;
    document.body.classList.toggle('links', !!s?.showLinks);
    const touchMode = save.settings.touch;
    const showTouch = !!s?.showTouch && (touchMode === 'on' || (touchMode === 'auto' && isTouchDevice()));
    document.body.classList.toggle('touch', showTouch);
    document.body.classList.toggle('touchmenu', !s?.showTouch && (touchMode === 'on' || (touchMode === 'auto' && isTouchDevice())));
    document.getElementById('crt')!.style.display = save.settings.crt ? 'block' : 'none';
  }

  start() {
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      if (!this.last) this.last = now;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt * this.speed;
      const step = 1 / 60;
      let n = 0;
      while (this.acc >= step && n < 8 * this.speed) {
        this.tick();
        this.acc -= step;
        n++;
      }
      if (n >= 8 * this.speed) this.acc = 0;
      this.render();
    };
    requestAnimationFrame(loop);
  }

  tick() {
    this.frame++;
    input.update();
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * 0.08;
      if (this.fadeDir > 0 && this.fade >= 1) {
        this.fade = 1;
        this.scene?.leave?.();
        this.scene = this.next;
        this.next = null;
        this.scene?.enter?.();
        this.updateOverlays();
        this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    } else this.scene?.update();
    input.endFrame();
  }

  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.scene?.draw(ctx);
    if (this.fade > 0) {
      // pixel dissolve wipe
      ctx.fillStyle = '#05030a';
      const f = this.fade;
      const cell = 16;
      for (let y = 0; y < H; y += cell)
        for (let x = 0; x < W; x += cell) {
          const k = Math.max(0, Math.min(1, f * 2 - ((x + y) / (W + H)) * 0.9));
          const s = Math.ceil(cell * k);
          if (s > 0) ctx.fillRect(x + (cell - s) / 2, y + (cell - s) / 2, s, s);
        }
    }
  }
}

export function isTouchDevice() {
  return 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

export function toggleFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (!document.fullscreenElement) {
    (el.requestFullscreen ? el.requestFullscreen() : Promise.resolve(el.webkitRequestFullscreen?.()))
      ?.then?.(() => {
        const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        so?.lock?.('landscape').catch(() => {});
      })
      .catch?.(() => {});
  } else document.exitFullscreen?.();
}

export const app = new App();
