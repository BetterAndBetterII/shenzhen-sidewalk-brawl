// Delivery-rider enemies & their comical (non-gory) defeat sequence.
import { audio } from '../core/audio';
import { clamp, drawSprite, drawSpriteRot, pick, rand, Sprite } from '../core/gfx';
import type { Style } from '../art/humanoid';
import { Brand, BRANDS, riderBody, RIDER_POSES, riderSprite, riderStyle, RiderPoseKind, VehicleKind } from '../art/riders';
import { FX, portrait } from '../art/props';
import { W } from '../core/gfx';
import { Z_MAX, Z_MIN } from '../art/backgrounds';
import { Attack, Ent, newAttackId } from './types';
import type { World } from './world';
import { diff } from './diff';

export type RiderType = 'cruiser' | 'weaver' | 'thrower' | 'dasher' | 'tank' | 'umbrella' | 'puppet' | 'cyclist';

interface RiderDef {
  brand: string;
  vk: VehicleKind;
  hp: number;
  speed: number;
  dmg: number;
  score: number;
  label: string;
}

export const RIDER_DEFS: Record<RiderType, RiderDef> = {
  cruiser: { brand: 'meican', vk: 'scooter', hp: 34, speed: 2.3, dmg: 10, score: 500, label: '吃了没骑手' },
  weaver: { brand: 'elema', vk: 'scooter', hp: 30, speed: 2.6, dmg: 10, score: 600, label: '跑腿兔骑手' },
  thrower: { brand: 'lvye', vk: 'scooter', hp: 36, speed: 2.1, dmg: 8, score: 700, label: '绿叶鲜生骑手' },
  dasher: { brand: 'shan', vk: 'sport', hp: 28, speed: 6.4, dmg: 14, score: 800, label: '秒送侠' },
  tank: { brand: 'shunfeng', vk: 'trike', hp: 110, speed: 1.1, dmg: 14, score: 1500, label: '速疯快运员' },
  umbrella: { brand: 'rain', vk: 'scooter', hp: 40, speed: 2.4, dmg: 11, score: 900, label: '雨伞骑手' },
  puppet: { brand: 'algo', vk: 'scooter', hp: 40, speed: 2.8, dmg: 12, score: 1000, label: '被绑定的骑手' },
  cyclist: { brand: 'elema', vk: 'bike', hp: 16, speed: 1.7, dmg: 6, score: 300, label: '逆行单车党' },
};

const RIDE_QUOTES = ['让一让!', '嘀嘀!', '超时了超时了!', '借过借过!', '还剩3分钟!', '系统催单啦!', '别挡道!', '红灯?来不及了!', '五星好评谢谢!'];
export const DEFEAT_QUOTES = [
  '对不起…我太赶了',
  '系统说8分钟必须送到…',
  '超时要扣钱的啊…',
  '我也不想上人行道啊',
  '订单…已送达…吧?',
  '下次一定慢点骑',
  '谢谢你让我停下来',
  '别给差评好吗…',
  '今天第58单了…',
  '是算法让我冲的…',
  '我家孩子还等我…',
  '腿…有点软',
];

const portraitCache = new Map<string, HTMLCanvasElement>();
export function riderPortrait(b: Brand): HTMLCanvasElement {
  let p = portraitCache.get(b.id);
  if (!p) {
    p = portrait(riderStyle(b), 22);
    portraitCache.set(b.id, p);
  }
  return p;
}

export class Rider extends Ent {
  type: RiderType;
  def: RiderDef;
  brand: Brand;
  vk: VehicleKind;
  state = 'enter';
  t = 0;
  dir = 1;
  speed = 0;
  targetZ = 190;
  baseZ = 190;
  stun = 0;
  ramCd = 0;
  honked = false;
  tilt = 0;
  grabbedBy: Ent | null = null;
  scale = 1;
  wheel = 0;
  stopsLeft = 1;
  throwsLeft = 0;
  waitT = 0;
  passes = 0;
  thrownAtk: Attack | null = null;
  shield = false;
  spr: Sprite;
  pose: RiderPoseKind = 'ride';
  armor = false;
  onDefeat: ((r: Rider) => void) | null = null;
  quoteCd = 0;
  style: Style | undefined = undefined;
  defeatQuotes: string[] | null = null;

  constructor(type: RiderType, side: number, z: number, w: World) {
    super();
    this.type = type;
    this.def = RIDER_DEFS[type];
    this.brand = BRANDS[this.def.brand];
    this.vk = this.def.vk;
    const d = diff();
    this.hp = this.maxHp = Math.round(this.def.hp * d.enemyHp);
    this.name = this.def.label;
    this.portrait = riderPortrait(this.brand);
    this.dir = side < 0 ? 1 : -1; // enters from left → moves right
    this.face = this.dir;
    this.x = side < 0 ? w.camX - 50 : w.camX + W + 50;
    this.z = clamp(z, Z_MIN, Z_MAX);
    this.baseZ = this.z;
    this.targetZ = this.z;
    this.hw = this.vk === 'trike' ? 22 : 15;
    this.hh = this.vk === 'trike' ? 48 : 42;
    this.shadow = this.vk === 'trike' ? 26 : 18;
    this.armor = type === 'tank';
    this.spr = riderSprite(this.brand, this.vk, 'ride', 0);
    if (type === 'dasher') this.state = 'enterRev';
    this.stopsLeft = type === 'cruiser' || type === 'umbrella' ? 1 : 0;
    this.throwsLeft = type === 'thrower' ? 2 : type === 'tank' ? 2 : 0;
  }

  get maxSpeed() {
    return this.def.speed * diff().enemySpeed;
  }

  canBeHit() {
    return !this.dead && !['offscreen', 'thrown', 'grabbedGone'].includes(this.state);
  }

  setState(s: string) {
    this.state = s;
    this.t = 0;
  }

  update(w: World) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.ramCd > 0) this.ramCd--;
    if (this.quoteCd > 0) this.quoteCd--;
    const p = w.player;
    const acc = 0.12;
    this.wheel += Math.abs(this.vx) * 0.25;
    this.pose = 'ride';
    const camL = w.camX;
    const camR = w.camX + W;
    if (this.grabbedBy && this.state !== 'grabbed' && this.state !== 'thrown') this.setState('grabbed');

    switch (this.state) {
      case 'enter':
      case 'cruise': {
        this.speed = Math.min(this.maxSpeed, this.speed + acc);
        this.vx = this.dir * this.speed;
        this.face = this.dir;
        // steering
        if (this.type === 'weaver' || (this.type === 'puppet' && this.passes % 2 === 1)) {
          this.targetZ = this.baseZ + Math.sin(this.t * 0.06) * 22;
        } else if (this.type === 'cyclist') {
          this.targetZ = this.baseZ + Math.sin(this.t * 0.11) * 6;
        } else if (Math.random() < 0.02 * diff().aggression) {
          // drift toward player lane when approaching
          const ahead = (p.x - this.x) * this.dir;
          if (ahead > 20 && ahead < 220) this.targetZ = p.z + rand(-4, 4);
        }
        this.targetZ = clamp(this.targetZ, Z_MIN, Z_MAX);
        this.vz = clamp((this.targetZ - this.z) * 0.05, -0.9, 0.9);
        const ahead = (p.x - this.x) * this.dir;
        // honk telegraph
        if (!this.honked && ahead > 30 && ahead < 110 && Math.abs(p.z - this.z) < 12) {
          this.honked = true;
          audio.sfx(this.vk === 'bike' ? 'bell' : 'honk', { pitch: 0.9 + Math.random() * 0.25, vol: 0.8 });
          if (this.quoteCd <= 0) {
            w.fx.say(this.vk === 'bike' ? '叮叮!' : Math.random() < 0.5 ? '嘀嘀!' : pick(RIDE_QUOTES), this, this.x, this.z, 54 * this.scale, 60);
            this.quoteCd = 200;
          }
        }
        // behaviors
        if ((this.type === 'cruiser' || this.type === 'umbrella') && this.stopsLeft > 0 && ahead > 60 && ahead < 120 && Math.random() < 0.03) {
          this.stopsLeft--;
          this.setState('phone');
        }
        if ((this.type === 'thrower' || this.type === 'tank') && this.throwsLeft > 0 && ahead > 90 && ahead < 180 && this.x > camL + 20 && this.x < camR - 20 && Math.random() < 0.04) {
          this.setState('throw');
        }
        if (this.state === 'enter' && this.x > camL + 10 && this.x < camR - 10) this.state = 'cruise';
        // leave screen
        if ((this.dir > 0 && this.x > camR + 50) || (this.dir < 0 && this.x < camL - 50)) {
          this.setState('offscreen');
          this.waitT = Math.floor(rand(30, 90));
        }
        break;
      }
      case 'phone': {
        this.vx *= 0.9;
        this.vz = 0;
        this.pose = 'phone';
        if (this.t === 10 && Math.random() < 0.6) w.fx.say(pick(['又来新单了…', '导航在哪…', '顾客说快点', '再接一单!']), this, this.x, this.z, 54, 70);
        if (this.t > 80) this.setState('cruise');
        break;
      }
      case 'throw': {
        this.vx *= 0.88;
        this.vz = 0;
        this.face = Math.sign(p.x - this.x) || this.face;
        this.pose = this.t > 14 && this.t < 30 ? 'throw' : 'ride';
        if (this.t === 30) {
          w.enemyThrow(this, this.type === 'tank' ? 'parcel' : 'cabbage');
          this.throwsLeft--;
        }
        if (this.t > 50) {
          if (this.throwsLeft > 0 && Math.random() < 0.5) {
            this.setState('throw');
          } else {
            this.setState('cruise');
            this.dir = this.face;
          }
        }
        break;
      }
      case 'enterRev': {
        // dasher appears at edge and revs
        const side = this.dir > 0 ? camL + 12 : camR - 12;
        this.x += (side - this.x) * 0.15;
        this.vx = 0;
        this.face = this.dir;
        if (this.t === 1) {
          this.z = clamp(p.z + rand(-6, 6), Z_MIN, Z_MAX);
          audio.sfx('rev');
        }
        this.pose = 'lean';
        if (this.t % 4 === 0) w.fx.dust(this.x - this.dir * 18, this.z, 1, -this.dir);
        const revLen = Math.round(56 / Math.max(0.8, diff().enemySpeed));
        if (this.t > revLen) {
          this.setState('dash');
          this.speed = this.maxSpeed;
          audio.sfx('zoom');
        }
        break;
      }
      case 'dash': {
        this.vx = this.dir * this.maxSpeed;
        this.vz = 0;
        this.pose = 'lean';
        if (this.t % 2 === 0) w.fx.ghost(this.spr, this.x, this.z, 0, this.face < 0, 'rgba(255,90,50,0.4)', 10);
        if ((this.dir > 0 && this.x > camR + 50) || (this.dir < 0 && this.x < camL - 50)) {
          this.setState('offscreen');
          this.waitT = Math.floor(rand(40, 80));
        }
        break;
      }
      case 'offscreen': {
        this.vx = 0;
        this.vz = 0;
        if (this.t > this.waitT) {
          this.passes++;
          this.dir = -this.dir;
          this.face = this.dir;
          this.honked = false;
          this.stopsLeft = this.type === 'cruiser' || this.type === 'umbrella' ? (Math.random() < 0.6 ? 1 : 0) : 0;
          if (this.type === 'thrower' || this.type === 'tank') this.throwsLeft = 1 + (Math.random() < 0.5 ? 1 : 0);
          const aim = Math.random() < diff().aggression;
          this.baseZ = this.targetZ = clamp(aim ? p.z + rand(-6, 6) : rand(Z_MIN, Z_MAX), Z_MIN, Z_MAX);
          this.z = this.baseZ;
          this.x = this.dir > 0 ? camL - 46 : camR + 46;
          this.speed = this.maxSpeed * 0.7;
          if (this.type === 'dasher' || (this.type === 'puppet' && this.passes % 3 === 0)) this.setState('enterRev');
          else this.setState('enter');
        }
        break;
      }
      case 'stagger': {
        this.vx *= 0.82;
        this.vz = 0;
        this.pose = 'hurt';
        this.tilt *= 0.8;
        if (this.t > 22) {
          if (this.stun >= 60) {
            this.stun = 0;
            this.setState('dizzy');
            audio.sfx('glitch', { vol: 0.4 });
          } else {
            this.speed = 0;
            this.setState('cruise');
            this.dir = Math.random() < 0.5 ? this.dir : -this.dir;
            if (this.type === 'dasher') {
              this.setState('cruise');
            }
          }
        }
        break;
      }
      case 'knock': {
        this.vx *= 0.9;
        this.vz = 0;
        this.pose = 'hurt';
        this.tilt = Math.sin(this.t * 0.5) * 0.2 * Math.max(0, 1 - this.t / 24) - 0.25 * this.face * Math.max(0, 1 - this.t / 20);
        if (this.t % 3 === 0 && Math.abs(this.vx) > 1) w.fx.dust(this.x, this.z, 1);
        if (this.t > 26) {
          this.tilt = 0;
          if (this.stun >= 60 && !this.armor) {
            this.stun = 0;
            this.setState('dizzy');
          } else {
            this.setState('stagger');
            this.t = 12;
          }
        }
        break;
      }
      case 'dizzy': {
        this.vx = 0;
        this.vz = 0;
        this.pose = 'hurt';
        if (this.t % 30 === 1 && this.t < 100) w.fx.pop('晕', this.x, this.z, 62 * this.scale, '#ffe040', 1, 26, 8);
        if (this.t > 150) {
          this.speed = 0;
          this.setState('cruise');
        }
        break;
      }
      case 'grabbed': {
        this.vx = 0;
        this.vz = 0;
        this.pose = 'hurt';
        if (!this.grabbedBy) {
          this.y = 0;
          this.setState('stagger');
        }
        break;
      }
      case 'thrown': {
        this.vy -= 0.25;
        this.y += this.vy;
        this.tilt += 0.25 * this.face;
        if (this.thrownAtk) w.thrownHits(this, this.thrownAtk);
        if (this.y <= 0) {
          this.y = 0;
          this.tilt = 0;
          w.shake(6);
          w.fx.dust(this.x, this.z, 10);
          w.fx.burst(this.x, this.z, 8, 10, ['#ffe040', '#ffffff', '#ff8a3a'], 3);
          audio.sfx('crash');
          this.thrownAtk = null;
          this.hp -= 22;
          if (this.hp <= 0) this.defeat(w, this.face);
          else {
            this.stun = 0;
            this.setState('dizzy');
          }
        }
        break;
      }
    }
    if (this.state !== 'thrown' && this.state !== 'grabbed') this.y = 0;
    this.x += this.vx;
    this.z = clamp(this.z + this.vz, Z_MIN, Z_MAX);
    this.ramCheck(w);
    this.updateSprite();
  }

  ramCheck(w: World) {
    if (!(['enter', 'cruise', 'dash', 'charge'].includes(this.state) && Math.abs(this.vx) > 1.4 && this.ramCd <= 0)) return;
    const pl = w.player;
    if (Math.abs(pl.z - this.z) < 9 + (this.scale - 1) * 8 && Math.abs(pl.x - this.x) < this.hw + 6 && pl.y < 16 * this.scale) {
      const atk: Attack = {
        id: newAttackId(),
        dmg: this.def.dmg,
        kb: Math.abs(this.vx) * 0.9 + 1,
        launch: Math.abs(this.vx) > 2.2 || this.type === 'tank' || this.isBoss,
        zr: 9,
        box: [0, 0, 0, 0],
        kind: 'ram',
        dir: this.dir,
        hitstop: 6,
      };
      if (pl.hurt(w, atk, this)) {
        this.ramCd = 50;
        audio.sfx('honk', { pitch: 1.2 / this.scale, vol: 0.6 });
        if (Math.random() < 0.5 && !this.isBoss) w.fx.say(pick(['抱歉抱歉!', '没看到你!', '赶时间啊!', '对不住!']), this, this.x, this.z, 54, 60);
      } else this.ramCd = 10;
    }
  }

  updateSprite() {
    const wf = Math.floor(this.wheel) % 3;
    this.spr = riderSprite(this.brand, this.vk, this.type === 'umbrella' && this.pose === 'ride' ? 'umbrella' : this.pose, wf, this.scale, this.style);
  }

  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }): boolean {
    if (!this.canBeHit()) return false;
    const dir = a.dir ?? (Math.sign(this.x - from.x) || from.face);
    // umbrella guard from the front
    if (this.type === 'umbrella' && ['enter', 'cruise', 'phone'].includes(this.state) && Math.sign(from.x - this.x) === this.face && a.kind === 'punch' && !a.air) {
      audio.sfx('block');
      w.fx.spark(this.x + this.face * 14, this.z, 36, 'sparkBlue');
      w.fx.pop('雨伞格挡!', this.x, this.z, 64, '#9ad8ff', 1, 30, 8);
      w.hitstop(3);
      return false;
    }
    let dmg = a.dmg;
    let counter = false;
    if (Math.abs(this.vx) > 2.2 && ['enter', 'cruise', 'dash'].includes(this.state) && a.kind !== 'proj') {
      counter = true;
      dmg = Math.round(dmg * 1.5);
    }
    this.hp -= dmg;
    this.stun += a.stun ?? 10;
    this.flash = 6;
    if (counter) {
      w.fx.pop('COUNTER!', this.x, this.z, 66, '#ff5a3a', 1, 40);
      audio.sfx('counter');
      w.addScore(200);
    }
    w.onEnemyHit(this, a, dmg);
    if (this.hp <= 0) {
      this.defeat(w, dir);
      return true;
    }
    if (this.armor && !a.launch && a.kind !== 'special' && a.kind !== 'super') {
      this.vx += dir * 0.3;
      return true;
    }
    this.face = -dir;
    this.speed = 0;
    if (a.launch || counter) {
      this.setState('knock');
      this.vx = dir * a.kb * (this.armor ? 0.5 : 1);
    } else {
      this.setState('stagger');
      this.vx = dir * a.kb;
    }
    return true;
  }

  defeat(w: World, dir: number) {
    if (this.dead) return;
    this.dead = true;
    this.remove = true;
    if (this.grabbedBy) (this.grabbedBy as Ent & { releaseGrab?: () => void }).releaseGrab?.();
    w.onEnemyDefeated(this);
    w.objs.push(new DefeatedRider(this, dir, w));
    if (this.onDefeat) this.onDefeat(this);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, w: World) {
    const sx = this.x - camX;
    const sy = this.z - this.y;
    if (this.tilt) {
      drawSpriteRot(ctx, this.spr, sx, sy, this.tilt, this.face < 0, 10);
    } else drawSprite(ctx, this.spr, sx, sy, this.face < 0, this.flash > 0 && this.flash % 2 === 1);
    if (this.state === 'dizzy') {
      const st = FX.stars[Math.floor(this.t / 3) % FX.stars.length];
      drawSprite(ctx, st, sx + this.face * -6, sy - 54 * this.scale);
    }
    if (this.state === 'enterRev') {
      // lane telegraph
      if (Math.floor(this.t / 4) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,60,40,0.35)';
        const x0 = this.dir > 0 ? sx + 20 : 0;
        const x1 = this.dir > 0 ? W : sx - 20;
        ctx.fillRect(Math.round(x0), Math.round(this.z - 3), Math.round(x1 - x0), 6);
      }
      if (Math.floor(this.t / 6) % 2 === 0) {
        ctx.fillStyle = '#ffe040';
        ctx.fillRect(Math.round(sx - 1), Math.round(sy - 66), 3, 8);
        ctx.fillRect(Math.round(sx - 1), Math.round(sy - 56), 3, 3);
      }
    }
    if (this.shield) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,60,120,${0.4 + Math.sin(this.t * 0.3) * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(Math.round(sx), Math.round(sy - 24), 26, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** Non-interactive comic defeat sequence: tumble → sit dizzy → quote → ride away calmly. */
export class DefeatedRider extends Ent {
  brand: Brand;
  vk: VehicleKind;
  phase = 0;
  t = 0;
  rx: number;
  rz: number;
  ry = 0;
  rvx: number;
  rvy = 3.6;
  rot = 0;
  sx: number;
  svx: number;
  stilt = 0;
  scale: number;
  quote: string;
  awayDir: number;
  spark = 0;
  style: Style | undefined;

  constructor(r: Rider, dir: number, w: World) {
    super();
    this.brand = r.brand;
    this.vk = r.vk;
    this.scale = r.scale;
    this.x = r.x;
    this.z = r.z;
    this.rx = r.x;
    this.rz = r.z;
    this.rvx = dir * 2.2;
    this.sx = r.x;
    this.svx = dir * 3.2;
    this.quote = pick(r.defeatQuotes || DEFEAT_QUOTES);
    this.style = r.style;
    this.awayDir = dir;
    this.dead = true;
    this.shadow = 0;
    audio.sfx('crash');
    w.fx.burst(r.x, r.z, 20, 14, ['#ffe040', '#ffffff', '#ff8a3a', '#9aa0aa'], 3.2);
    w.fx.spark(r.x, r.z, 24, 'spark');
  }
  canBeHit() {
    return false;
  }
  update(w: World) {
    this.t++;
    if (this.phase === 0) {
      // tumble
      this.rx += this.rvx;
      this.ry += this.rvy;
      this.rvy -= 0.22;
      this.rot += 0.35 * Math.sign(this.rvx || 1);
      this.sx += this.svx;
      this.svx *= 0.95;
      this.stilt = Math.min(Math.PI / 2, this.stilt + 0.12);
      if (this.t % 3 === 0 && Math.abs(this.svx) > 0.5) {
        w.fx.burst(this.sx, this.z, 2, 2, ['#ffe040', '#ffffff'], 1.5, 0.1, 10);
        if (this.t % 9 === 0) audio.sfx('break', { vol: 0.3 });
      }
      if (this.ry <= 0 && this.rvy < 0) {
        this.ry = 0;
        this.rot = 0;
        this.phase = 1;
        this.t = 0;
        w.fx.dust(this.rx, this.rz, 6);
        audio.sfx('land');
      }
    } else if (this.phase === 1) {
      this.svx *= 0.9;
      this.sx += this.svx;
      if (this.t === 16) w.fx.say(this.quote, { x: this.rx, z: this.rz, y: 0 }, this.rx, this.rz, 34, 90, '#1a1020');
      if (this.t > 100) {
        this.phase = 2;
        this.t = 0;
        w.fx.dust(this.sx, this.z, 10);
        audio.sfx('pickup', { vol: 0.5 });
        this.x = this.sx;
        this.awayDir = this.x < w.player.x ? -1 : 1;
      }
    } else {
      // ride away slowly, politely
      this.x += this.awayDir * Math.min(1.6, this.t * 0.04);
      if (this.t === 10 && Math.random() < 0.5) w.fx.say(pick(['慢慢骑…', '安全第一', '谢了兄弟', '走非机动车道']), { x: this.x, z: this.z, y: 0 }, this.x, this.z, 54, 60);
      if (this.x < w.camX - 80 || this.x > w.camX + W + 80) this.remove = true;
    }
    this.z = this.phase === 2 ? this.z : this.rz;
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    if (this.phase < 2) {
      // tipped scooter
      const sc = riderSprite(this.brand, this.vk, 'empty', 0, this.scale, this.style);
      drawSpriteRot(ctx, sc, this.sx - camX, this.z, -this.stilt * Math.sign(this.svx || 1) * 0.6, this.svx < 0, 6);
      if (this.phase === 0) {
        const body = riderBody(this.brand, RIDER_POSES.tumble, this.scale);
        drawSpriteRot(ctx, body, this.rx - camX, this.rz - this.ry - 12, this.rot, this.rvx < 0, 14);
      } else {
        const body = riderBody(this.brand, RIDER_POSES.sit, this.scale);
        drawSprite(ctx, body, this.rx - camX, this.rz + 2, this.rvx > 0);
        const st = FX.stars[Math.floor(this.t / 3) % FX.stars.length];
        drawSprite(ctx, st, this.rx - camX, this.rz - 30 * this.scale);
      }
    } else {
      ctx.globalAlpha = 0.9;
      const s = riderSprite(this.brand, this.vk, 'ride', Math.floor(this.t / 6) % 3, this.scale, this.style);
      drawSprite(ctx, s, this.x - camX, this.z, this.awayDir < 0);
      ctx.globalAlpha = 1;
    }
  }
}
