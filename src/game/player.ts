// The hero: 阿龙.
import { audio } from '../core/audio';
import { clamp, drawSprite } from '../core/gfx';
import { input } from '../core/input';
import { HERO, HeroSprite } from '../art/hero';
import { Z_MAX, Z_MIN } from '../art/backgrounds';
import { Attack, Ent, newAttackId } from './types';
import type { World } from './world';
import { diff } from './diff';

type PState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'airkick'
  | 'airpunch'
  | 'jab'
  | 'cross'
  | 'upper'
  | 'kick'
  | 'flykick'
  | 'spin'
  | 'roll'
  | 'hurt'
  | 'fall'
  | 'down'
  | 'getup'
  | 'specialHold'
  | 'hadoken'
  | 'efist'
  | 'super'
  | 'grab'
  | 'knee'
  | 'lift'
  | 'throw'
  | 'pickup'
  | 'throwItem'
  | 'dead'
  | 'respawn'
  | 'victory'
  | 'auto'
  | 'fallHole';

interface AtkDef {
  len: number;
  a0: number;
  a1: number;
  dmg: number;
  kb: number;
  launch?: boolean;
  stun: number;
  hs: number;
  box: [number, number, number, number];
  kind: Attack['kind'];
  spark?: Attack['spark'];
  next?: number; // chain window opens
  sfx?: string;
  zr?: number;
}

const ATK: Record<string, AtkDef> = {
  jab: { len: 13, a0: 3, a1: 6, dmg: 5, kb: 0.9, stun: 14, hs: 4, box: [2, 26, 24, 42], kind: 'punch', next: 6 },
  cross: { len: 15, a0: 4, a1: 7, dmg: 6, kb: 1.1, stun: 16, hs: 4, box: [2, 28, 24, 42], kind: 'punch', next: 7 },
  upper: { len: 26, a0: 6, a1: 11, dmg: 11, kb: 2.8, launch: true, stun: 34, hs: 8, box: [0, 26, 20, 56], kind: 'punch' },
  kick: { len: 24, a0: 6, a1: 11, dmg: 10, kb: 3, launch: true, stun: 26, hs: 7, box: [4, 34, 12, 36], kind: 'kick' },
  flykick: { len: 32, a0: 3, a1: 20, dmg: 13, kb: 3.8, launch: true, stun: 30, hs: 7, box: [4, 32, 12, 38], kind: 'kick' },
  airkick: { len: 999, a0: 3, a1: 999, dmg: 10, kb: 2.6, launch: true, stun: 24, hs: 6, box: [-2, 26, -6, 24], kind: 'kick' },
  airpunch: { len: 18, a0: 3, a1: 11, dmg: 8, kb: 1.6, stun: 18, hs: 5, box: [2, 26, 8, 36], kind: 'punch' },
  efist: { len: 30, a0: 7, a1: 13, dmg: 26, kb: 5.2, launch: true, stun: 60, hs: 11, box: [2, 48, 14, 46], kind: 'special', spark: 'sparkBlue', zr: 14 },
  spin: { len: 34, a0: 4, a1: 28, dmg: 9, kb: 3.2, launch: true, stun: 20, hs: 4, box: [-28, 28, 8, 42], kind: 'kick' },
  knee: { len: 16, a0: 4, a1: 7, dmg: 6, kb: 0, stun: 0, hs: 4, box: [0, 26, 10, 40], kind: 'punch' },
};

export const METER_BAR = 100;

export class Player extends Ent {
  state: PState = 'idle';
  t = 0;
  anim = 0;
  meter = 100;
  maxMeter = 300;
  lives = 3;
  invuln = 0;
  atk: Attack | null = null;
  atkDef: AtkDef | null = null;
  chain = 0;
  carrying: Ent | null = null;
  grabbed: Ent | null = null;
  grabT = 0;
  knees = 0;
  chargeLv = 0;
  perfectUsed = false;
  lastTap = { dir: 0, t: -99 };
  running = false;
  airAttackUsed = false;
  autoTarget = 0;
  spr: HeroSprite = HERO.idle[0];
  tail = 0;
  stats = { hitsTaken: 0, dmgTaken: 0 };
  displayHp = 100;

  constructor() {
    super();
    this.hp = this.maxHp = 100;
    this.hw = 8;
    this.hh = 46;
    this.shadow = 11;
    this.name = '阿龙';
  }

  setState(s: PState) {
    this.state = s;
    this.t = 0;
    this.atk = null;
    this.atkDef = null;
  }

  canBeHit() {
    return !this.dead && this.invuln <= 0 && !['down', 'getup', 'dead', 'respawn', 'super', 'victory', 'auto', 'fallHole'].includes(this.state) && !(this.state === 'fall' && this.t < 999 && this.y > 0 && this.vy < 2 && false);
  }

  private neutral() {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'run';
  }

  startAttack(name: string) {
    this.setState(name as PState);
    this.atkDef = ATK[name];
    audio.sfx('whoosh', { pitch: name === 'kick' || name === 'flykick' ? 0.7 : 1 + Math.random() * 0.2 });
  }

  makeAttack(def: AtkDef): Attack {
    return {
      id: newAttackId(),
      dmg: def.dmg,
      kb: def.kb,
      launch: def.launch,
      stun: def.stun,
      hitstop: def.hs,
      zr: def.zr ?? 10,
      box: def.box,
      kind: def.kind,
      spark: def.spark,
      air: this.y > 2,
    };
  }

  update(w: World) {
    this.t++;
    this.anim++;
    this.tail += 0.35;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    this.meter = Math.min(this.maxMeter, this.meter + diff().regen);
    this.displayHp += (this.hp - this.displayHp) * 0.08;
    if (Math.abs(this.displayHp - this.hp) < 0.3) this.displayHp = this.hp;
    const I = input;
    const dx = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    const dz = (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);
    const ctrl = w.controlEnabled();

    // double-tap run detection
    for (const [b, d] of [
      ['right', 1],
      ['left', -1],
    ] as const) {
      if (I.pressed(b)) {
        if (this.lastTap.dir === d && I.frame - this.lastTap.t < 14) this.running = true;
        this.lastTap = { dir: d, t: I.frame };
      }
    }
    if (dx === 0) this.running = false;

    const st = this.state;
    switch (st) {
      case 'idle':
      case 'walk':
      case 'run': {
        if (!ctrl) {
          this.vx = 0;
          this.vz = 0;
          this.state = 'idle';
          break;
        }
        const carrying = !!this.carrying;
        const sp = this.running && !carrying ? 2.6 : carrying ? 1.0 : 1.35;
        this.vx = dx * sp;
        this.vz = dz * (this.running ? 1.0 : 0.95);
        if (dx) this.face = dx;
        const moving = dx || dz;
        const ns: PState = moving ? (this.running && !carrying ? 'run' : 'walk') : 'idle';
        if (ns !== st) {
          this.state = ns;
        }
        if (this.state === 'run' && this.anim % 8 === 0) w.fx.dust(this.x - this.face * 6, this.z, 1, -this.face);
        // grab on walking into a dizzy enemy
        this.handleNeutralActions(w, dx, dz);
        break;
      }
      case 'jump':
      case 'airkick':
      case 'airpunch': {
        this.vy -= 0.24;
        this.y += this.vy;
        if (st === 'jump' && ctrl && !this.airAttackUsed) {
          if (I.buffered('kick', 4)) {
            I.consume('kick');
            this.airAttackUsed = true;
            this.state = 'airkick';
            this.t = 0;
            this.atkDef = ATK.airkick;
            audio.sfx('whoosh', { pitch: 0.8 });
          } else if (I.buffered('punch', 4)) {
            I.consume('punch');
            this.airAttackUsed = true;
            this.state = 'airpunch';
            this.t = 0;
            this.atkDef = ATK.airpunch;
            audio.sfx('whoosh');
          }
        }
        if (st === 'airpunch' && this.t > 18) {
          this.state = 'jump';
          this.atk = null;
        }
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.atk = null;
          this.atkDef = null;
          this.setState('idle');
          w.fx.dust(this.x, this.z, 5);
          audio.sfx('land');
          this.vx *= 0.3;
        }
        break;
      }
      case 'jab':
      case 'cross':
      case 'upper':
      case 'kick':
      case 'knee': {
        const def = this.atkDef!;
        this.vx *= 0.7;
        this.vz *= 0.5;
        if (st === 'upper' && this.t === 6) this.vx = this.face * 1.2;
        if (st === 'kick' && this.t === 6) this.vx = this.face * 1.4;
        // chaining
        if (def.next && this.t >= def.next && ctrl) {
          if (I.buffered('kick', 8) && st !== 'kick') {
            I.consume('kick');
            this.chain = 0;
            this.startAttack('kick');
            break;
          }
          if (I.buffered('punch', 8) && (st === 'jab' || st === 'cross')) {
            I.consume('punch');
            const target = w.grabbable(this);
            if (target) {
              this.startGrab(w, target);
              break;
            }
            this.startAttack(st === 'jab' ? 'cross' : 'upper');
            break;
          }
        }
        if (st === 'knee' && this.t >= def.len) {
          this.state = 'grab';
          this.t = 30;
          break;
        }
        if (this.t >= def.len) this.setState('idle');
        break;
      }
      case 'flykick': {
        this.vx = this.face * Math.max(0.5, 3.6 - this.t * 0.1);
        if (this.t < 16) this.y = Math.sin((this.t / 16) * Math.PI) * 10;
        else this.y = Math.max(0, this.y - 1);
        if (this.t % 3 === 0) w.fx.ghost(this.spr, this.x, this.z, this.y, this.face < 0);
        if (this.t >= ATK.flykick.len) {
          this.y = 0;
          this.setState('idle');
        }
        break;
      }
      case 'spin': {
        this.vx *= 0.8;
        this.y = this.t < 26 ? 6 : Math.max(0, this.y - 1.5);
        if (this.t % 6 === 0 && this.t < 28) {
          this.face = -this.face;
          if (this.atk) this.atk.id = newAttackId();
          audio.sfx('whoosh', { pitch: 1.3 });
        }
        if (this.t >= ATK.spin.len) {
          this.y = 0;
          this.setState('idle');
        }
        break;
      }
      case 'roll': {
        const k = Math.max(0, 1 - this.t / 22);
        this.vx = this.rollDir[0] * 3.4 * k + this.rollDir[0] * 0.3;
        this.vz = this.rollDir[1] * 1.6 * k;
        if (this.t % 3 === 0) w.fx.ghost(this.spr, this.x, this.z, this.y, this.face < 0, 'rgba(255,255,255,0.4)', 8);
        if (this.t >= 22) this.setState('idle');
        break;
      }
      case 'hurt': {
        this.vx *= 0.85;
        this.vz = 0;
        if (this.t >= 18) this.setState('idle');
        break;
      }
      case 'fall': {
        this.vy -= 0.22;
        this.y += this.vy;
        if (this.y <= 0 && this.vy < 0) {
          this.y = 0;
          if (this.vy < -2.5) {
            this.vy = -this.vy * 0.35;
            this.vx *= 0.5;
            w.fx.dust(this.x, this.z, 6);
            w.shake(3);
            audio.sfx('land', { vol: 1.5 });
          } else {
            this.vy = 0;
            this.vx = 0;
            this.setState('down');
          }
        }
        break;
      }
      case 'down': {
        this.vx = 0;
        if (this.hp <= 0) {
          if (this.t >= 40) {
            this.setState('dead');
            w.playerDied();
          }
        } else if (this.t >= 34 || (this.t > 14 && (I.pressed('jump') || I.pressed('punch')))) this.setState('getup');
        break;
      }
      case 'getup': {
        if (this.t >= 16) {
          this.setState('idle');
          this.invuln = 70;
        }
        break;
      }
      case 'dead':
        break;
      case 'respawn': {
        this.vy -= 0.25;
        this.y = Math.max(0, this.y + this.vy);
        if (this.y <= 0) {
          if (this.t > 2) {
            w.fx.dust(this.x, this.z, 10);
            w.fx.ring(this.x, this.z, '#ffffff', 5, 18);
            w.shake(4);
            audio.sfx('land', { vol: 2 });
            w.clearNear(this.x, 90);
            this.setState('idle');
            this.invuln = 120;
          }
        }
        break;
      }
      case 'fallHole': {
        this.vx = 0;
        this.vz = 0;
        if (this.t < 20) this.y = -this.t * 2.5;
        if (this.t === 50) {
          this.y = 0;
          this.hp = Math.max(1, this.hp - Math.round(12 * diff().dmgTaken));
          this.stats.hitsTaken++;
          this.x += this.face * 34;
          this.setState('respawn');
          this.y = 60;
          this.vy = 0;
        }
        break;
      }
      case 'specialHold': {
        this.vx *= 0.7;
        this.vz *= 0.7;
        const held = I.held.special;
        const lvNeed = [0, 28, 66, 110];
        const affordable = Math.floor(this.meter / METER_BAR);
        const prev = this.chargeLv;
        let lv = 0;
        for (let i = 1; i <= 3; i++) if (this.t >= lvNeed[i] && affordable >= i) lv = i;
        this.chargeLv = lv;
        if (lv > prev) {
          audio.sfx('chargeFull');
          w.fx.ring(this.x, this.z, lv === 3 ? '#ffe040' : '#6ad8ff', 3, 16);
          if (lv === 3) w.fx.pop('超必杀准备!', this.x, this.z, 60, '#ffe040', 1, 50);
        }
        if (this.t > 10) {
          if (this.t % 10 === 0) audio.sfx('charge', { pitch: 1 + lv * 0.4 + this.t * 0.004 });
          const c = lv === 3 ? ['#ffe860', '#ffffff', '#ffb020'] : ['#6ad8ff', '#ffffff', '#3a8aff'];
          if (this.t % 2 === 0)
            w.fx.parts.push({
              x: this.x + (Math.random() - 0.5) * 30,
              z: this.z,
              y: Math.random() * 10,
              vx: 0,
              vz: 0,
              vy: 0.8 + Math.random() * 1.2 + lv * 0.3,
              g: 0,
              life: 22,
              max: 22,
              color: c[Math.floor(Math.random() * 3)],
              size: 1 + (Math.random() < 0.3 ? 1 : 0),
              glow: true,
            });
        }
        if (!held || !ctrl) {
          if (this.t < 14 || lv === 0) {
            if (this.meter >= METER_BAR) {
              this.meter -= METER_BAR;
              this.startAttack('efist');
              audio.sfx('energy');
            } else {
              w.fx.pop('气不足!', this.x, this.z, 58, '#9ad8ff', 1, 40);
              audio.sfx('back');
              this.setState('idle');
            }
          } else if (lv === 3) {
            this.meter -= METER_BAR * 3;
            this.setState('super');
            w.startSuper(this);
          } else {
            this.meter -= METER_BAR * lv;
            this.setState('hadoken');
            w.spawnWave(this, lv);
            audio.sfx('blast');
          }
        }
        if (I.pressed('dodge')) this.startRoll(dx, dz);
        break;
      }
      case 'hadoken': {
        this.vx = -this.face * 0.6 * Math.max(0, 1 - this.t / 10);
        if (this.t >= 26) this.setState('idle');
        break;
      }
      case 'efist': {
        if (this.t === 7) {
          this.vx = this.face * 3.2;
          w.shake(3);
          w.fx.ring(this.x + this.face * 30, this.z, '#6ad8ff', 4, 14);
        }
        this.vx *= 0.86;
        if (this.t >= 7 && this.t <= 14) {
          const f = this.fistWorld();
          w.fx.burst(f[0], this.z, f[1], 2, ['#6ad8ff', '#ffffff', '#3a8aff'], 1.5, 0, 14, 1, true);
        }
        if (this.t >= ATK.efist.len) this.setState('idle');
        break;
      }
      case 'super': {
        // world handles cinematic, we just pose
        if (this.t >= 80) this.setState('idle');
        break;
      }
      case 'grab': {
        this.vx = 0;
        this.vz = 0;
        this.grabT++;
        const g = this.grabbed as (Ent & { grabbedBy?: Ent | null; state?: string }) | null;
        if (!g || g.dead || this.grabT > 110) {
          this.releaseGrab();
          this.setState('idle');
          break;
        }
        g.x = this.x + this.face * 20;
        g.z = this.z + 0.5;
        if (ctrl) {
          if (I.buffered('kick', 6) || (I.buffered('punch', 6) && dx !== 0) || (I.buffered('punch', 6) && this.knees >= 3)) {
            I.consume('kick');
            I.consume('punch');
            if (dx) this.face = dx;
            this.setState('lift');
            audio.sfx('grab');
          } else if (I.buffered('punch', 6)) {
            I.consume('punch');
            this.knees++;
            this.startAttack('knee');
            this.atk = this.makeAttack(ATK.knee);
            w.hitGrabbed(this, g, this.atk);
          }
        }
        break;
      }
      case 'lift': {
        const g = this.grabbed;
        if (!g || g.dead) {
          this.releaseGrab();
          this.setState('idle');
          break;
        }
        g.x = this.x + this.face * Math.max(0, 20 - this.t * 1.5);
        g.y = Math.min(30, this.t * 2.2);
        g.z = this.z + 0.5;
        if (this.t === 14) {
          this.setState('throw');
          w.throwGrabbed(this, g);
          this.grabbed = null;
        }
        break;
      }
      case 'throw': {
        if (this.t >= 20) this.setState('idle');
        break;
      }
      case 'pickup': {
        this.vx = 0;
        this.vz = 0;
        if (this.t >= 10) this.setState('idle');
        break;
      }
      case 'throwItem': {
        if (this.t >= 16) this.setState('idle');
        break;
      }
      case 'victory': {
        this.vx = 0;
        this.vz = 0;
        break;
      }
      case 'auto': {
        const d = this.autoTarget - this.x;
        this.vx = Math.abs(d) > 2 ? Math.sign(d) * 1.4 : 0;
        this.vz = 0;
        if (this.vx) this.face = Math.sign(this.vx);
        break;
      }
    }

    // active attack windows
    const def = this.atkDef;
    if (def && ['jab', 'cross', 'upper', 'kick', 'flykick', 'airkick', 'airpunch', 'efist', 'spin'].includes(this.state)) {
      if (this.t === def.a0) this.atk = this.makeAttack(def);
      if (this.t > def.a1) this.atk = null;
      if (this.atk) w.playerAttack(this, this.atk);
    }

    // integrate
    if (!['jump', 'airkick', 'airpunch', 'fall', 'respawn', 'flykick', 'spin', 'fallHole'].includes(this.state)) this.y = 0;
    if (['jump', 'airkick', 'airpunch'].includes(this.state)) {
      // slight air control
      if (ctrl) this.vx = clamp(this.vx + dx * 0.08, -2.8, 2.8);
    }
    this.x += this.vx;
    this.z = clamp(this.z + this.vz, Z_MIN, Z_MAX);
    w.clampToCamera(this);
    if (this.carrying) {
      const c = this.carrying;
      c.x = this.x;
      c.z = this.z + 0.2;
      c.y = this.y + 46;
    }
    this.pickSprite();
  }

  rollDir: [number, number] = [0, 0];
  startRoll(dx: number, dz: number) {
    this.setState('roll');
    this.perfectUsed = false;
    let rx = dx;
    const rz = dz;
    if (!rx && !rz) rx = -this.face;
    const n = Math.hypot(rx, rz) || 1;
    this.rollDir = [rx / n, rz / n];
    audio.sfx('dodge');
    if (this.carrying) this.dropCarry();
  }

  handleNeutralActions(w: World, dx: number, dz: number) {
    const I = input;
    if (I.buffered('punch', 3) && I.buffered('kick', 3)) {
      I.consume('punch');
      I.consume('kick');
      if (this.carrying) this.dropCarry();
      this.startAttack('spin');
      this.invuln = Math.max(this.invuln, 22);
      const cost = Math.round(6 * diff().dmgTaken);
      if (this.hp > cost + 1) this.hp -= cost;
      audio.sfx('shout', { pitch: 1.4 });
      return;
    }
    if (I.pressed('dodge')) {
      this.startRoll(dx, dz);
      return;
    }
    if (I.buffered('jump', 4)) {
      I.consume('jump');
      this.setState('jump');
      this.vy = 4.4;
      this.vx = dx * (this.running ? 2.4 : 1.4);
      this.airAttackUsed = false;
      audio.sfx('jump');
      w.fx.dust(this.x, this.z, 3);
      return;
    }
    if (I.pressed('special')) {
      if (this.carrying) this.dropCarry();
      this.setState('specialHold');
      this.chargeLv = 0;
      return;
    }
    if (I.buffered('kick', 3) && !I.held.punch) {
      // wait a couple frames to allow J+K
      if (I.frame - I.pressTime.kick < 2) return;
      I.consume('kick');
      if (this.carrying) {
        this.throwCarry(w);
        return;
      }
      if (this.state === 'run') {
        this.startAttack('flykick');
        audio.sfx('shout', { pitch: 1.2 });
      } else this.startAttack('kick');
      return;
    }
    if (I.buffered('punch', 3) && !I.held.kick) {
      if (I.frame - I.pressTime.punch < 2) return;
      I.consume('punch');
      if (this.carrying) {
        this.throwCarry(w);
        return;
      }
      const target = w.grabbable(this);
      if (target) {
        this.startGrab(w, target);
        return;
      }
      const item = w.pickupable(this);
      if (item) {
        this.carrying = item;
        (item as Ent & { carried?: boolean }).carried = true;
        this.setState('pickup');
        audio.sfx('grab');
        return;
      }
      this.startAttack('jab');
    }
  }

  startGrab(w: World, target: Ent) {
    this.grabbed = target;
    (target as Ent & { grabbedBy?: Ent | null }).grabbedBy = this;
    this.grabT = 0;
    this.knees = 0;
    this.setState('grab');
    audio.sfx('grab');
    w.fx.pop('抓住!', this.x + this.face * 20, this.z, 58, '#ffffff', 1, 30);
  }
  releaseGrab() {
    if (this.grabbed) (this.grabbed as Ent & { grabbedBy?: Ent | null }).grabbedBy = null;
    this.grabbed = null;
  }

  throwCarry(w: World) {
    const c = this.carrying;
    if (!c) return;
    this.carrying = null;
    this.setState('throwItem');
    w.throwProp(this, c);
    audio.sfx('throw');
  }
  dropCarry() {
    const c = this.carrying as (Ent & { carried?: boolean }) | null;
    if (!c) return;
    c.carried = false;
    c.y = 0;
    c.x = this.x - this.face * 10;
    this.carrying = null;
  }

  fistWorld(): [number, number] {
    const f = this.spr.fist;
    return [this.x + f[0] * this.face, this.y - f[1]];
  }

  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }): boolean {
    if (!this.canBeHit()) return false;
    if (this.state === 'roll') {
      if (this.t <= 15) {
        if (!this.perfectUsed && this.t <= 12) {
          this.perfectUsed = true;
          w.perfectDodge(this);
        }
        return false;
      }
    }
    const dir = a.dir ?? (Math.sign(this.x - from.x) || -from.face || 1);
    const dmg = Math.max(1, Math.round(a.dmg * diff().dmgTaken));
    this.hp = Math.max(0, this.hp - dmg);
    this.stats.hitsTaken++;
    this.stats.dmgTaken += dmg;
    this.meter = Math.min(this.maxMeter, this.meter + 10);
    this.flash = 6;
    this.releaseGrab();
    if (this.carrying) this.dropCarry();
    audio.sfx(a.launch ? 'hitHeavy' : 'hurt');
    w.fx.spark(this.x, this.z, 30, a.spark || 'sparkRed');
    w.fx.burst(this.x, this.z, 30, 6, ['#ff5a3a', '#ffe040', '#ffffff'], 2);
    w.hitstop(a.hitstop ?? 5);
    w.shake(a.launch ? 6 : 3);
    w.resetCombo();
    if (a.launch || this.hp <= 0 || this.y > 0) {
      this.setState('fall');
      this.face = -dir;
      this.vx = dir * Math.max(2, a.kb);
      this.vy = 3.2;
      this.y = Math.max(this.y, 1);
    } else {
      this.setState('hurt');
      this.face = -dir;
      this.vx = dir * Math.max(1, a.kb * 0.6);
    }
    return true;
  }

  pickSprite() {
    const H = HERO;
    const a = this.anim;
    const t = this.t;
    let s: HeroSprite;
    switch (this.state) {
      case 'idle':
        s = this.carrying ? H.carryIdle[0] : H.idle[Math.floor(a / 10) % 4];
        break;
      case 'walk':
        s = this.carrying ? H.carry[Math.floor(a / 6) % 8] : H.walk[Math.floor(a / 6) % 8];
        break;
      case 'run':
        s = H.run[Math.floor(a / 4) % 6];
        break;
      case 'jump':
        s = H.jump[this.vy > 0 ? 0 : 1];
        break;
      case 'airkick':
        s = H.airkick[0];
        break;
      case 'airpunch':
        s = t < 3 ? H.jump[0] : H.airpunch[0];
        break;
      case 'jab':
        s = H.jab[t < 3 ? 0 : t < 6 ? 1 : t < 9 ? 2 : 3];
        break;
      case 'cross':
        s = H.cross[t < 4 ? 0 : t < 7 ? 1 : t < 10 ? 2 : 3];
        break;
      case 'upper':
        s = H.upper[t < 6 ? 0 : t < 9 ? 1 : t < 18 ? 2 : 3];
        break;
      case 'kick':
        s = H.kick[t < 6 ? 0 : t < 9 ? 1 : t < 16 ? 2 : 3];
        break;
      case 'knee':
        s = t < 4 || t > 10 ? H.grab[0] : H.knee[0];
        break;
      case 'flykick':
        s = H.flykick[Math.floor(t / 4) % 2];
        break;
      case 'spin':
        s = H.spin[Math.floor(t / 3) % 2];
        break;
      case 'roll':
        s = H.roll[Math.min(3, Math.floor(t / 5)) % 4];
        break;
      case 'hurt':
        s = H.hurt[t < 8 ? 0 : 1];
        break;
      case 'fall':
        s = H.fall[this.vy > 0 ? 0 : 1];
        break;
      case 'down':
      case 'dead':
        s = H.down[0];
        break;
      case 'getup':
        s = H.getup[t < 8 ? 0 : 1];
        break;
      case 'specialHold':
        s = t < 10 ? H.efist[0] : H.charge[Math.floor(a / 4) % 2];
        break;
      case 'hadoken':
        s = H.hadoken[Math.floor(t / 4) % 2];
        break;
      case 'efist':
        s = H.efist[t < 7 ? 0 : 1];
        break;
      case 'super':
        s = t < 30 ? H.charge[Math.floor(a / 3) % 2] : H.upper[2];
        break;
      case 'grab':
        s = H.grab[0];
        break;
      case 'lift':
        s = H.lift[t < 7 ? 0 : 1];
        break;
      case 'throw':
        s = H.throw[0];
        break;
      case 'pickup':
        s = H.pickup[0];
        break;
      case 'throwItem':
        s = H.throw[0];
        break;
      case 'victory':
        s = H.victory[Math.floor(a / 12) % 2];
        break;
      case 'auto':
        s = this.vx ? H.walk[Math.floor(a / 6) % 8] : H.idle[Math.floor(a / 10) % 4];
        break;
      case 'respawn':
        s = H.jump[1];
        break;
      case 'fallHole':
        s = H.fall[0];
        break;
      default:
        s = H.idle[0];
    }
    this.spr = s;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, w: World) {
    if (this.state === 'fallHole' && this.t > 20) return;
    if (this.invuln > 0 && Math.floor(this.invuln / 3) % 2 === 0 && this.state !== 'respawn') return;
    const sx = this.x - camX;
    const sy = this.z - this.y;
    // charge aura
    if (this.state === 'specialHold' && this.t > 10) {
      const lv = this.chargeLv;
      ctx.globalCompositeOperation = 'lighter';
      const r = 16 + lv * 4 + Math.sin(this.t * 0.6) * 2;
      ctx.fillStyle = lv === 3 ? 'rgba(255,200,60,0.25)' : 'rgba(60,170,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(Math.round(sx), Math.round(sy - 22), r * 0.8, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    drawSprite(ctx, this.spr, sx, sy, this.face < 0, this.flash > 0 && this.flash % 2 === 1);
    // energy fist glow
    if ((this.state === 'efist' && this.t >= 5 && this.t < 18) || (this.state === 'specialHold' && this.t > 10)) {
      const f = this.spr.fist;
      const fx = sx + f[0] * this.face;
      const fy = sy + f[1];
      const big = this.state === 'efist' ? 1 : 0.6;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 3; i >= 1; i--) {
        ctx.fillStyle = i === 1 ? 'rgba(220,250,255,0.9)' : i === 2 ? 'rgba(90,200,255,0.55)' : 'rgba(40,120,255,0.35)';
        const r = (i * 3 + Math.sin(this.anim) * 1) * big + (this.state === 'specialHold' ? this.chargeLv * 1.2 : 0);
        ctx.beginPath();
        ctx.arc(Math.round(fx), Math.round(fy), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
