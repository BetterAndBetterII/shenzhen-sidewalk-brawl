// Unified input: keyboard + gamepad + touch → virtual buttons.
export type Btn = 'left' | 'right' | 'up' | 'down' | 'punch' | 'kick' | 'jump' | 'dodge' | 'special' | 'start' | 'back';
export const BTNS: Btn[] = ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump', 'dodge', 'special', 'start', 'back'];

const KEYMAP: Record<string, Btn[]> = {
  ArrowLeft: ['left'],
  ArrowRight: ['right'],
  ArrowUp: ['up'],
  ArrowDown: ['down'],
  KeyA: ['left'],
  KeyD: ['right'],
  KeyW: ['up'],
  KeyS: ['down'],
  KeyJ: ['punch'],
  KeyZ: ['punch'],
  KeyK: ['kick'],
  KeyX: ['kick'],
  KeyL: ['jump'],
  KeyC: ['jump'],
  Space: ['jump'],
  KeyI: ['special'],
  KeyV: ['special'],
  KeyU: ['dodge'],
  ShiftLeft: ['dodge'],
  ShiftRight: ['dodge'],
  Enter: ['start'],
  NumpadEnter: ['start'],
  Escape: ['back'],
  KeyP: ['back'],
  Backspace: ['back'],
};

export class Input {
  held: Record<Btn, boolean> = {} as Record<Btn, boolean>;
  prev: Record<Btn, boolean> = {} as Record<Btn, boolean>;
  pressTime: Record<Btn, number> = {} as Record<Btn, number>;
  releaseTime: Record<Btn, number> = {} as Record<Btn, number>;
  frame = 0;
  private codes = new Set<string>();
  private kb: Record<string, boolean> = {};
  touch: Record<Btn, boolean> = {} as Record<Btn, boolean>;
  touchAxis = { x: 0, y: 0 };
  pad: Record<Btn, boolean> = {} as Record<Btn, boolean>;
  padAxis = { x: 0, y: 0 };
  /** synthetic input (bot / tests) */
  bot: Record<Btn, boolean> | null = null;
  clicks: { x: number; y: number }[] = [];
  anyKeyPressed = false;
  lastDevice: 'kb' | 'pad' | 'touch' = 'kb';
  onFirstGesture: (() => void) | null = null;

  constructor() {
    for (const b of BTNS) {
      this.held[b] = false;
      this.prev[b] = false;
      this.pressTime[b] = -999;
      this.releaseTime[b] = -999;
      this.touch[b] = false;
      this.pad[b] = false;
    }
    window.addEventListener('keydown', (e) => {
      const bs = KEYMAP[e.code];
      this.gesture();
      this.lastDevice = 'kb';
      if (bs) {
        e.preventDefault();
        if (e.repeat) return;
        this.codes.add(e.code);
      }
      this.anyKeyPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      const bs = KEYMAP[e.code];
      if (bs) {
        e.preventDefault();
        this.codes.delete(e.code);
      }
    });
    window.addEventListener('blur', () => this.codes.clear());
  }

  gesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const b of BTNS) this.pad[b] = false;
    this.padAxis.x = 0;
    this.padAxis.y = 0;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const bt = (i: number) => !!gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const p = this.pad;
      p.left = p.left || ax < -0.4 || bt(14);
      p.right = p.right || ax > 0.4 || bt(15);
      p.up = p.up || ay < -0.4 || bt(12);
      p.down = p.down || ay > 0.4 || bt(13);
      p.jump = p.jump || bt(0);
      p.dodge = p.dodge || bt(1) || bt(4);
      p.punch = p.punch || bt(2);
      p.kick = p.kick || bt(3);
      p.special = p.special || bt(5) || bt(7) || bt(6);
      p.start = p.start || bt(9);
      p.back = p.back || bt(8);
      if (Math.abs(ax) > 0.4 || Math.abs(ay) > 0.4) {
        this.padAxis.x = ax;
        this.padAxis.y = ay;
      }
      if (gp.buttons.some((b) => b.pressed)) {
        this.lastDevice = 'pad';
        this.anyKeyPressed = true;
      }
    }
  }

  update() {
    this.frame++;
    this.pollPad();
    for (const b of BTNS) this.kb[b] = false;
    for (const c of this.codes) for (const b of KEYMAP[c] || []) this.kb[b] = true;
    for (const b of BTNS) {
      this.prev[b] = this.held[b];
      const v = this.bot ? !!this.bot[b] : this.kb[b] || this.touch[b] || this.pad[b];
      this.held[b] = v;
      if (v && !this.prev[b]) this.pressTime[b] = this.frame;
      if (!v && this.prev[b]) this.releaseTime[b] = this.frame;
    }
  }

  pressed(b: Btn) {
    return this.held[b] && !this.prev[b];
  }
  released(b: Btn) {
    return !this.held[b] && this.prev[b];
  }
  /** was pressed within the last n frames (input buffer) */
  buffered(b: Btn, n = 6) {
    return this.frame - this.pressTime[b] < n;
  }
  consume(b: Btn) {
    this.pressTime[b] = -999;
  }
  confirm() {
    return this.pressed('start') || this.pressed('punch') || this.pressed('jump');
  }
  cancel() {
    return this.pressed('back') || this.pressed('kick');
  }
  takeClick(): { x: number; y: number } | null {
    return this.clicks.shift() || null;
  }
  endFrame() {
    this.anyKeyPressed = false;
    this.clicks.length = 0;
  }
}

export const input = new Input();
