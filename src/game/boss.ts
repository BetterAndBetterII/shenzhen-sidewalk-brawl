// Stage bosses (rider-based) and the final boss, the dispatch algorithm.
import { audio } from '../core/audio';
import { clamp, drawSprite, pick, rand, W } from '../core/gfx';
import { drawText } from '../core/text';
import { Z_MAX, Z_MIN } from '../art/backgrounds';
import { BRANDS, riderStyle } from '../art/riders';
import { portrait, PROPS } from '../art/props';
import type { Style } from '../art/humanoid';
import { Rider, RiderType } from './enemies';
import { Attack, Ent, newAttackId } from './types';
import { Proj } from './objects';
import type { World } from './world';
import { diff } from './diff';

export interface BossDef {
  id: string;
  name: string;
  title: string;
  brand: string;
  vk: 'scooter' | 'sport' | 'trike' | 'moto';
  scale: number;
  hp: number;
  speed: number;
  dmg: number;
  patterns: string[];
  minion: RiderType;
  intro: string;
  defeat: string[];
  taunts: string[];
  style?: Partial<Style>;
  guard?: boolean;
}

export const BOSSES: Record<string, BossDef> = {
  dan: {
    id: 'dan',
    name: '黄哥',
    title: '单王',
    brand: 'boss1',
    vk: 'scooter',
    scale: 1.45,
    hp: 360,
    speed: 4.2,
    dmg: 14,
    patterns: ['charge', 'toss', 'charge', 'honkwave', 'summon'],
    minion: 'cruiser',
    intro: '今天的单王，是我！让开！',
    defeat: ['单王…也要扣超时费的…', '我只是…不想被系统降级'],
    taunts: ['冲单啦!', '兄弟们上!', '五星好评!'],
  },
  fa: {
    id: 'fa',
    name: '发哥',
    title: '摩的佬',
    brand: 'moto',
    vk: 'moto',
    scale: 1.35,
    hp: 420,
    speed: 3.8,
    dmg: 14,
    patterns: ['shout', 'charge', 'quake', 'shout', 'helmet'],
    minion: 'cyclist',
    intro: '靓仔！去边度呀？十蚊！',
    defeat: ['地铁开通后…生意难做啊', '靓仔…你行路小心啲'],
    taunts: ['靓仔!', '上车啦!', '好快㗎!'],
    style: { head: 'cap', helmet: '#3a5a8a', sleeves: true, top: '#6a5a4a' },
  },
  feng: {
    id: 'feng',
    name: '疾风',
    title: '秒送侠',
    brand: 'wind',
    vk: 'sport',
    scale: 1.4,
    hp: 400,
    speed: 7.5,
    dmg: 15,
    patterns: ['afterimage', 'charge', 'rest', 'afterimage', 'charge', 'charge', 'rest'],
    minion: 'dasher',
    intro: '跨城秒送48分钟！挡我者——超时！',
    defeat: ['其实…我也想慢慢看风景', '深南大道…原来这么美'],
    taunts: ['太慢了!', '残影!', '闪!'],
  },
  qiang: {
    id: 'qiang',
    name: '强哥',
    title: '魔改王',
    brand: 'mod',
    vk: 'scooter',
    scale: 1.5,
    hp: 480,
    speed: 4,
    dmg: 14,
    patterns: ['drones', 'soundwave', 'charge', 'emp', 'soundwave'],
    minion: 'weaver',
    intro: '电池魔改到续航200公里！',
    defeat: ['魔改…只是想多跑几单…', '这电池…其实是二手的'],
    taunts: ['低音炮!', '无人机出动!', '超频!'],
  },
  wei: {
    id: 'wei',
    name: '阿伟',
    title: '雨夜骑士',
    brand: 'rain',
    vk: 'scooter',
    scale: 1.5,
    hp: 520,
    speed: 4.2,
    dmg: 15,
    patterns: ['spin', 'lightning', 'charge', 'water', 'rest', 'lightning', 'charge'],
    minion: 'umbrella',
    intro: '下雨天，单价加两块……冲！',
    defeat: ['雨衣…其实早就湿透了', '雨这么大…你也早点回家'],
    taunts: ['雨伞护体!', '打雷啦!', '水花!'],
    guard: true,
  },
  wang: {
    id: 'wang',
    name: '王经理',
    title: '配送站长',
    brand: 'station',
    vk: 'trike',
    scale: 1.4,
    hp: 600,
    speed: 3.2,
    dmg: 16,
    patterns: ['megaphone', 'tickets', 'summon', 'charge', 'megaphone'],
    minion: 'tank',
    intro: '这个月KPI，必须冲进片区前三！',
    defeat: ['我…我也是被考核的…', 'KPI…到底是谁定的…'],
    taunts: ['KPI!!', '罚款!', '扣绩效!'],
    style: { head: 'manager', sleeves: true, top: '#f0f0f4', tie: '#d02a2a', hair: '#1a1418', glasses: true, pants: '#2a2a3a' },
  },
};

export class Boss extends Rider {
  bdef: BossDef;
  pat = 0;
  act = 'intro';
  at = 0;
  poise = 0;
  enraged = false;
  lane = 0;
  lanes: number[] = [];
  sub = 0;
  minions: Rider[] = [];

  constructor(id: string, w: World) {
    super('cruiser', 1, 190, w);
    const d = BOSSES[id];
    this.bdef = d;
    this.isBoss = true;
    this.brand = BRANDS[d.brand];
    this.vk = d.vk;
    this.scale = d.scale;
    this.hp = this.maxHp = Math.round(d.hp * (0.85 + diff().enemyHp * 0.15 + (diff().enemyHp - 1) * 0.3));
    this.name = `${d.title}·${d.name}`;
    this.def = { ...this.def, dmg: d.dmg, speed: d.speed, label: this.name };
    this.style = d.style ? { ...riderStyle(this.brand), ...d.style } : undefined;
    this.portrait = portrait(this.style || riderStyle(this.brand), 22);
    this.hw = 22 * d.scale * (this.vk === 'trike' ? 1.3 : 1);
    this.hh = 44 * d.scale;
    this.shadow = 20 * d.scale;
    this.x = w.camX + W + 70;
    this.z = 196;
    this.dir = -1;
    this.face = -1;
    this.state = 'boss';
    this.defeatQuotes = d.defeat;
  }

  canBeHit() {
    return !this.dead && this.act !== 'intro' && this.act !== 'offscreen';
  }

  next(w: World) {
    const list = this.bdef.patterns;
    this.act = list[this.pat % list.length];
    this.pat++;
    this.at = 0;
    this.sub = 0;
    if (Math.random() < 0.25) w.fx.say(pick(this.bdef.taunts), this, this.x, this.z, 70 * this.scale, 50);
  }

  update(w: World) {
    this.t++;
    this.at++;
    if (this.flash > 0) this.flash--;
    if (this.ramCd > 0) this.ramCd--;
    const p = w.player;
    const camL = w.camX;
    const camR = w.camX + W;
    this.wheel += Math.abs(this.vx) * 0.2 + 0.05;
    this.pose = 'ride';
    this.state = 'boss';
    const spd = this.bdef.speed * diff().enemySpeed * (this.enraged ? 1.15 : 1);
    if (!this.enraged && this.hp < this.maxHp * 0.45) {
      this.enraged = true;
      w.fx.pop('暴走!', this.x, this.z, 90, '#ff3a3a', 2, 60);
      audio.sfx('alarm');
    }
    const faceP = () => {
      this.face = Math.sign(p.x - this.x) || this.face;
      this.dir = this.face;
    };
    const toward = (tx: number, tz: number, s: number) => {
      const dx = tx - this.x;
      const dz = tz - this.z;
      this.vx = Math.abs(dx) > s ? Math.sign(dx) * s : dx;
      this.vz = clamp(dz * 0.08, -1.2, 1.2);
      if (Math.abs(this.vx) > 0.3) this.face = Math.sign(this.vx);
      return Math.abs(dx) < 4 && Math.abs(dz) < 4;
    };

    switch (this.act) {
      case 'intro': {
        this.vx = -1.6;
        this.face = -1;
        if (this.x < camR - 90) {
          this.vx = 0;
          if (this.at > 60) {
            w.bossIntroDone(this);
            this.next(w);
          }
        } else this.at = 0;
        break;
      }
      case 'stagger': {
        this.vx *= 0.85;
        this.vz = 0;
        this.pose = 'hurt';
        if (this.at > 34) this.next(w);
        break;
      }
      case 'dizzy': {
        this.vx *= 0.8;
        this.vz = 0;
        this.pose = 'hurt';
        if (this.at % 30 === 1 && this.at < 100) w.fx.pop('晕', this.x, this.z, 70 * this.scale, '#ffe040', 1, 26, 8);
        if (this.at > 140) this.next(w);
        break;
      }
      case 'recover': {
        this.vx *= 0.9;
        this.vz = 0;
        this.pose = 'lean';
        if (this.at > (this.enraged ? 30 : 46)) this.next(w);
        break;
      }
      case 'rest': {
        this.vx *= 0.9;
        this.pose = 'hurt';
        if (this.at === 2) w.fx.say('呼…呼…', this, this.x, this.z, 70 * this.scale, 60);
        if (this.at > 90) this.next(w);
        break;
      }
      case 'charge': {
        // 0: go to edge, 1: telegraph, 2: dash
        if (this.sub === 0) {
          const side = p.x > (camL + camR) / 2 ? camL + 30 : camR - 30;
          const done = toward(side, clamp(p.z, Z_MIN, Z_MAX), spd * 0.8);
          if (done || this.at > 90) {
            this.sub = 1;
            this.at = 0;
            faceP();
            this.lane = this.z;
            audio.sfx('rev', { pitch: 0.8 });
          }
        } else if (this.sub === 1) {
          this.vx = 0;
          this.vz = clamp((p.z - this.z) * 0.04, -0.5, 0.5);
          this.pose = 'lean';
          faceP();
          if (this.at % 4 === 0) w.fx.dust(this.x - this.face * 24, this.z, 1, -this.face);
          if (this.at > (this.enraged ? 30 : 44)) {
            this.sub = 2;
            this.at = 0;
            audio.sfx('zoom', { pitch: 0.8 });
            this.dir = this.face;
          }
        } else {
          this.vx = this.dir * spd;
          this.vz = 0;
          this.pose = 'lean';
          if (this.at % 2 === 0) w.fx.ghost(this.spr, this.x, this.z, 0, this.face < 0, 'rgba(255,120,60,0.35)', 10);
          if ((this.dir > 0 && this.x > camR - 26) || (this.dir < 0 && this.x < camL + 26)) {
            this.x = clamp(this.x, camL + 26, camR - 26);
            this.vx = 0;
            w.shake(4);
            w.fx.dust(this.x, this.z, 8, -this.dir);
            audio.sfx('crash', { vol: 0.5 });
            if (this.dodgedThisCharge) {
              this.dodgedThisCharge = false;
              w.fx.pop('撞墙!', this.x, this.z, 80, '#ffe040', 1.5, 50);
              this.act = 'dizzy';
              this.at = 0;
            } else {
              this.act = 'recover';
              this.at = 0;
            }
          }
        }
        break;
      }
      case 'afterimage': {
        // telegraph 3 lanes then dash through each
        if (this.sub === 0) {
          this.lanes = [clamp(p.z, Z_MIN, Z_MAX), rand(Z_MIN, Z_MAX), rand(Z_MIN, Z_MAX)];
          this.sub = 1;
          this.at = 0;
          w.fx.say('残影·三连闪!', this, this.x, this.z, 70 * this.scale, 50);
          audio.sfx('rev');
        } else if (this.sub <= 3) {
          const lz = this.lanes[this.sub - 1];
          if (this.at === 1) {
            this.x = this.sub % 2 ? camL - 40 : camR + 40;
            this.z = lz;
            this.dir = this.sub % 2 ? 1 : -1;
            this.face = this.dir;
            w.telegraphLane(lz, this.enraged ? 26 : 36);
          }
          if (this.at < (this.enraged ? 26 : 36)) this.vx = 0;
          else {
            this.vx = this.dir * spd * 1.2;
            if (this.at % 2 === 0) w.fx.ghost(this.spr, this.x, this.z, 0, this.face < 0, 'rgba(255,90,40,0.45)', 12);
            if (this.at === (this.enraged ? 26 : 36)) audio.sfx('zoom');
          }
          if ((this.dir > 0 && this.x > camR + 40) || (this.dir < 0 && this.x < camL - 40)) {
            this.sub++;
            this.at = 0;
          }
        } else {
          this.x = camR - 40;
          this.z = rand(Z_MIN + 10, Z_MAX - 10);
          this.vx = 0;
          this.act = 'rest';
          this.at = 0;
        }
        this.pose = 'lean';
        break;
      }
      case 'toss':
      case 'tickets':
      case 'helmet': {
        this.vx *= 0.85;
        this.vz = clamp((p.z - this.z) * 0.03, -0.6, 0.6);
        faceP();
        this.pose = this.at % 30 > 12 && this.at % 30 < 24 ? 'throw' : 'ride';
        const n = this.act === 'helmet' ? 1 : this.enraged ? 4 : 3;
        if (this.at % 30 === 20 && this.sub < n) {
          this.sub++;
          if (this.act === 'toss') w.enemyThrow(this, 'parcel', 1.25);
          else if (this.act === 'tickets') {
            for (const dz of [-14, 0, 14]) {
              const pr = new Proj('ticket', 'enemy', this.x + this.face * 20, clamp(this.z + dz, Z_MIN, Z_MAX), 34, this.face * 3.2, 0, { dmg: 8, kb: 1.5 });
              pr.vrot = 0.3;
              w.objs.push(pr);
            }
            audio.sfx('throw');
            w.fx.say(pick(['罚款!', '扣绩效!', '通报批评!']), this, this.x, this.z, 70 * this.scale, 40);
          } else {
            const pr = new Proj('helmet', 'enemy', this.x + this.face * 20, p.z, 30, this.face * 4, 0, { dmg: 10, kb: 2.5, launch: true }, 100);
            w.objs.push(pr);
            audio.sfx('throw');
          }
        }
        if (this.at > n * 30 + 30) this.next(w);
        break;
      }
      case 'honkwave':
      case 'quake': {
        this.vx *= 0.85;
        this.vz = 0;
        this.pose = 'honk';
        const count = this.enraged ? 3 : 2;
        if (this.at === 1) w.fx.say(this.act === 'quake' ? '轰——!' : '嘀——!!!', this, this.x, this.z, 70 * this.scale, 40);
        if (this.at % 34 === 20 && this.sub < count) {
          this.sub++;
          if (this.act === 'quake') {
            w.shake(8);
            audio.sfx('hitHeavy');
          } else audio.sfx('honk', { pitch: 0.6, vol: 1.3 });
          w.shockwave(this.x, this.z, this.act === 'quake' ? '#ffb040' : '#ffe860', this.bdef.dmg - 4);
        }
        if (this.at > count * 34 + 30) this.next(w);
        break;
      }
      case 'shout': {
        this.vx *= 0.85;
        this.vz = clamp((p.z - this.z) * 0.05, -0.8, 0.8);
        faceP();
        this.pose = 'shout';
        if (this.at === 20 || (this.enraged && this.at === 50)) {
          const txt = pick(['靓仔!', '去边度?', '十蚊!', '上车!']);
          const pr = new Proj('shout', 'enemy', this.x + this.face * 30, this.z, 30, this.face * 2.6, 0, { dmg: 10, kb: 2.5, launch: true, box: [-14, 14, -8, 10] }, 260);
          pr.text = txt;
          pr.breakable = true;
          w.objs.push(pr);
          audio.sfx('shout', { pitch: 0.8 });
        }
        if (this.at > 80) this.next(w);
        break;
      }
      case 'summon': {
        this.vx *= 0.85;
        this.pose = 'honk';
        if (this.at === 10) {
          w.fx.say('兄弟们，冲单！', this, this.x, this.z, 70 * this.scale, 60);
          audio.sfx('honk', { pitch: 0.7 });
          const alive = w.enemies.filter((e) => e !== this && !e.dead).length;
          const n = Math.max(0, (this.enraged ? 3 : 2) - alive);
          for (let i = 0; i < n; i++) w.spawnRider(this.bdef.minion, i % 2 ? -1 : 1, rand(Z_MIN, Z_MAX), i * 30);
        }
        if (this.at > 60) this.next(w);
        break;
      }
      case 'drones': {
        this.vx *= 0.85;
        this.pose = 'honk';
        if (this.at === 10) {
          w.fx.say('无人机出动!', this, this.x, this.z, 70 * this.scale, 50);
          const n = w.enemies.filter((e) => e instanceof Drone).length;
          for (let i = n; i < (this.enraged ? 3 : 2); i++) w.enemies.push(new Drone(this.x, this.z, i));
          audio.sfx('laser');
        }
        if (this.at > 50) this.next(w);
        break;
      }
      case 'soundwave': {
        this.vx *= 0.85;
        this.vz = clamp((p.z - this.z) * 0.05, -0.8, 0.8);
        faceP();
        this.pose = 'honk';
        if (this.at % 24 === 12 && this.sub < (this.enraged ? 4 : 3)) {
          this.sub++;
          const pr = new Proj('soundwave', 'enemy', this.x + this.face * 30, this.z, 10, this.face * 3.4, 0, { dmg: 9, kb: 2, box: [-10, 10, 0, 30] }, 160);
          w.objs.push(pr);
          audio.sfx('honk', { pitch: 0.5 });
        }
        if (this.at > 110) this.next(w);
        break;
      }
      case 'emp':
      case 'lightning': {
        this.vx *= 0.85;
        this.pose = 'honk';
        if (this.at === 5) {
          w.fx.say(this.act === 'emp' ? '超频放电!' : '天雷!', this, this.x, this.z, 70 * this.scale, 50);
          const n = this.enraged ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const tx = i === 0 ? p.x : clamp(p.x + rand(-120, 120), camL + 20, camR - 20);
            const tz = i === 0 ? p.z : rand(Z_MIN, Z_MAX);
            w.addStrike(tx, tz, this.act, 50 + i * 12, this.bdef.dmg);
          }
        }
        if (this.at > 110) this.next(w);
        break;
      }
      case 'spin': {
        this.vx *= 0.9;
        this.pose = 'umbrella';
        if (this.at === 2) w.fx.say('雨伞护体!', this, this.x, this.z, 70 * this.scale, 50);
        if (this.at % 10 === 0) w.fx.burst(this.x, this.z, 60, 4, ['#8ad0ff', '#ffffff'], 2.5, 0.15, 20);
        if (this.at > 90) this.next(w);
        break;
      }
      case 'water': {
        this.vx *= 0.85;
        faceP();
        if (this.at % 26 === 14 && this.sub < 3) {
          this.sub++;
          const pr = new Proj('water', 'enemy', this.x + this.face * 30, clamp(p.z + rand(-4, 4), Z_MIN, Z_MAX), 0, this.face * 3.6, 0, { dmg: 10, kb: 3, launch: true, box: [-10, 10, 0, 14], zr: 8 }, 200);
          w.objs.push(pr);
          audio.sfx('splash');
        }
        if (this.at > 100) this.next(w);
        break;
      }
      case 'megaphone': {
        this.vx *= 0.85;
        this.vz = clamp((p.z - this.z) * 0.05, -0.8, 0.8);
        faceP();
        this.pose = 'shout';
        if (this.at === 14) w.fx.say('KPI!!!', this, this.x, this.z, 70 * this.scale, 50);
        if (this.at % 20 === 18 && this.sub < 3) {
          this.sub++;
          for (const dz of [-12, 0, 12]) {
            const pr = new Proj('shout', 'enemy', this.x + this.face * 30, clamp(this.z + dz, Z_MIN, Z_MAX), 30, this.face * 3, 0, { dmg: 9, kb: 2, box: [-14, 14, -8, 10] }, 200);
            pr.text = pick(['KPI', '加班', '冲单', '罚款']);
            pr.breakable = true;
            w.objs.push(pr);
          }
          audio.sfx('shout', { pitch: 0.7 });
        }
        if (this.at > 90) this.next(w);
        break;
      }
      default:
        this.next(w);
    }
    // never camp in a screen corner: drift back so the player can get behind
    if (!['charge', 'afterimage', 'intro', 'offscreen'].includes(this.act)) {
      const margin = 70 * this.scale;
      if (this.x < camL + margin) this.x += 0.9;
      else if (this.x > camR - margin) this.x -= 0.9;
    }
    this.x += this.vx;
    this.z = clamp(this.z + this.vz, Z_MIN, Z_MAX);
    this.y = 0;
    this.state = this.act === 'charge' && this.sub === 2 ? 'charge' : this.act === 'afterimage' && Math.abs(this.vx) > 1 ? 'dash' : 'boss';
    if (this.bdef.guard && this.pose === 'ride') this.pose = 'umbrella';
    this.ramCheck(w);
    this.updateSprite();
  }

  dodgedThisCharge = false;

  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }): boolean {
    if (!this.canBeHit()) return false;
    const dir = a.dir ?? (Math.sign(this.x - from.x) || from.face);
    if (this.bdef.guard && ['spin', 'recover', 'charge', 'water', 'lightning'].includes(this.act) && this.act !== 'dizzy') {
      const front = Math.sign(from.x - this.x) === this.face;
      if ((front && a.kind !== 'super' && !a.air) || this.act === 'spin') {
        audio.sfx('block');
        w.fx.spark(this.x + this.face * 20, this.z, 50, 'sparkBlue');
        w.fx.pop('格挡! 打背后!', this.x, this.z, 90, '#9ad8ff', 1, 34, 8);
        w.hitstop(3);
        return false;
      }
    }
    const mult = this.act === 'dizzy' || this.act === 'rest' ? 1.4 : 1;
    const dmg = Math.round(a.dmg * mult);
    this.hp -= dmg;
    this.flash = 6;
    this.poise += a.kind === 'special' || a.kind === 'super' ? 40 : a.launch ? 18 : 8;
    w.onEnemyHit(this, a, dmg);
    if (this.hp <= 0) {
      this.bossDefeat(w);
      return true;
    }
    if (this.poise >= 70 && !['dizzy', 'stagger'].includes(this.act)) {
      this.poise = 0;
      this.act = 'stagger';
      this.at = 0;
      this.vx = dir * 2.5;
      this.face = -dir;
    } else this.vx += dir * 0.25;
    return true;
  }

  bossDefeat(w: World) {
    if (this.dead) return;
    for (const e of w.enemies) if (e !== this && !e.dead && e instanceof Drone) e.remove = true;
    this.defeat(w, -this.face || 1);
    w.onBossDefeated(this);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, w: World) {
    super.draw(ctx, camX, w);
    if (this.act === 'dizzy') {
      // reuse rider dizzy stars
    }
    if (this.act === 'charge' && this.sub === 1 && Math.floor(this.at / 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,40,0.35)';
      const sx = this.x - camX;
      const x0 = this.face > 0 ? sx + 30 : 0;
      const x1 = this.face > 0 ? W : sx - 30;
      ctx.fillRect(Math.round(x0), Math.round(this.z - 4), Math.round(x1 - x0), 8);
    }
  }
}

/** Small drone spawned by 魔改王: hovers over the player and drops phone cases. */
export class Drone extends Ent {
  t = 0;
  i: number;
  constructor(x: number, z: number, i: number) {
    super();
    this.x = x;
    this.z = z;
    this.y = 40;
    this.i = i;
    this.hp = this.maxHp = 8;
    this.hw = 8;
    this.hh = 12;
    this.shadow = 6;
    this.name = '无人机';
    this.portrait = dronePortrait();
  }
  update(w: World) {
    this.t++;
    if (this.flash > 0) this.flash--;
    const p = w.player;
    const tx = p.x + Math.sin(this.t * 0.03 + this.i * 2) * 50;
    this.x += (tx - this.x) * 0.02;
    this.z += (p.z - this.z) * 0.03;
    this.y = 36 + Math.sin(this.t * 0.1) * 3;
    if (this.t % 100 === 60 + this.i * 20) {
      const pr = new Proj('phonecase', 'enemy', this.x, this.z, this.y, 0, 0, { dmg: 7, kb: 1 });
      pr.g = 0.2;
      w.objs.push(pr);
      audio.sfx('throw', { vol: 0.5 });
    }
  }
  hurt(w: World, a: Attack) {
    this.hp -= a.dmg;
    this.flash = 4;
    w.onEnemyHit(this, a, a.dmg);
    if (this.hp <= 0) {
      this.dead = true;
      this.remove = true;
      w.fx.burst(this.x, this.z, this.y, 14, ['#ffe040', '#ff5a3a', '#9aa0aa'], 2.5);
      audio.sfx('crash', { vol: 0.5 });
      w.addScore(300);
    }
    return true;
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    drawSprite(ctx, PROPS.drone, this.x - camX, this.z - this.y, false, this.flash > 0);
    if (this.t % 4 < 2) {
      ctx.fillStyle = '#c0c4cc';
      ctx.fillRect(Math.round(this.x - camX - 9), Math.round(this.z - this.y - 3), 5, 1);
      ctx.fillRect(Math.round(this.x - camX + 4), Math.round(this.z - this.y - 3), 5, 1);
    }
  }
}

let dronePic: HTMLCanvasElement | null = null;
function dronePortrait(): HTMLCanvasElement {
  if (dronePic) return dronePic;
  const c = document.createElement('canvas');
  c.width = 22;
  c.height = 22;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1a2a3a';
  x.fillRect(0, 0, 22, 22);
  const s = PROPS.drone;
  x.drawImage(s.c, Math.round(11 - s.c.width / 2), Math.round(12 - s.c.height / 2));
  dronePic = c;
  return c;
}

/** Final boss: 派单算法 ALGO-9000 */
export class Algo extends Ent {
  t = 0;
  at = 0;
  act = 'intro';
  phase = 1;
  shield = false;
  puppets: Rider[] = [];
  pendingSummon = 0;
  coreOpen = 0;
  eye = 0;
  glitch = 0;
  targetX = 0;
  pat = 0;
  hover = 0;

  constructor(w: World) {
    super();
    this.isBoss = true;
    this.name = '派单算法·ALGO-9000';
    this.hp = this.maxHp = Math.round(1000 * (0.8 + diff().enemyHp * 0.2));
    this.x = w.camX + W / 2;
    this.z = Z_MIN + 4;
    this.y = 140;
    this.hw = 44;
    this.hh = 70;
    this.shadow = 40;
    this.targetX = this.x;
    this.portrait = makeAlgoPortrait();
  }
  canBeHit() {
    return !this.dead && this.act !== 'intro';
  }
  summon(w: World, n: number) {
    w.fx.say('派单：强制接单！', this, this.x, this.z, 120, 60, '#d01a3a');
    audio.sfx('alarm');
    // keep the arena readable: never more than 4 bound riders at once
    const alive = w.enemies.filter((e) => e instanceof Rider && !e.dead).length;
    n = Math.max(1, Math.min(n, 4 - alive));
    for (let i = 0; i < n; i++) {
      const r = w.spawnRider(this.phase >= 3 && i % 2 ? 'dasher' : 'puppet', i % 2 ? -1 : 1, rand(Z_MIN + 20, Z_MAX), 0);
      if (r) {
        r.x += (i % 2 ? -1 : 1) * Math.floor(i / 2) * 40; // stagger entries without losing track of them
        r.tethered = true;
        if (this.phase >= 3 && i % 2) {
          r.brand = BRANDS.algo;
        }
        r.defeatQuotes = ['我…为什么在这?', '谢谢你…把我叫醒', '终于不用抢单了', '我的眼睛…能看清路了', '原来我被绑定了…'];
        this.puppets.push(r);
      }
    }
    this.shield = true;
  }
  deathT = 0;
  update(w: World) {
    this.t++;
    this.at++;
    if (this.flash > 0) this.flash--;
    if (this.glitch > 0) this.glitch--;
    if (this.dead) {
      this.deathT++;
      this.glitch = 10;
      this.y -= 0.3;
      if (this.deathT % 8 === 0) {
        w.fx.burst(this.x + rand(-50, 50), this.z, this.y + rand(20, 90), 12, ['#ff2a4a', '#ffffff', '#c08aff', '#3af0ff'], 3, 0.05, 30, 2, true);
        audio.sfx('glitch');
        w.shake(4);
      }
      if (this.deathT > 140) this.remove = true;
      return;
    }
    const p = w.player;
    const camL = w.camX;
    this.puppets = this.puppets.filter((r) => !r.dead);
    if (this.shield && this.puppets.length === 0) {
      this.shield = false;
      this.coreOpen = 480;
      w.addTime(25);
      w.fx.pop('护盾解除! 核心暴露!', this.x, this.z, 110, '#ffe040', 1.5, 80);
      audio.sfx('glitch');
      audio.sfx('chargeFull');
    }
    if (this.coreOpen > 0) this.coreOpen--;
    else if (this.pendingSummon > 0) {
      this.summon(w, this.pendingSummon);
      this.pendingSummon = 0;
    }
    // hover motion
    this.hover = Math.sin(this.t * 0.03) * 4;
    if (this.act !== 'intro') {
      if (this.t % 200 === 0) this.targetX = clamp(p.x + rand(-60, 60), camL + 90, camL + W - 90);
      this.x += (this.targetX - this.x) * 0.01;
      this.y += ((this.coreOpen > 0 ? 6 : 26) - this.y) * 0.05;
    }
    const newPhase = this.hp < this.maxHp * 0.33 ? 3 : this.hp < this.maxHp * 0.66 ? 2 : 1;
    if (newPhase > this.phase) {
      this.phase = newPhase;
      this.glitch = 60;
      w.addTime(30);
      w.shake(10);
      audio.sfx('glitch');
      w.fx.pop(this.phase === 2 ? '算法升级 v2.0' : '算法失控 v∞', this.x, this.z, 120, '#ff3a6a', 2, 80);
      // don't slam the shield shut while the core is exposed — re-bind riders once it closes
      if (this.coreOpen > 0) this.pendingSummon = this.phase === 2 ? 3 : 4;
      else this.summon(w, this.phase === 2 ? 3 : 4);
    }
    const sp = this.phase === 3 ? 0.7 : this.phase === 2 ? 0.85 : 1;
    switch (this.act) {
      case 'intro':
        this.y += (26 - this.y) * 0.04;
        if (this.at > 140) {
          w.bossIntroDone(this);
          this.summon(w, 2);
          this.act = 'pins';
          this.at = 0;
        }
        break;
      case 'pins': {
        const n = this.phase === 3 ? 14 : this.phase === 2 ? 10 : 7;
        if (this.at === 1) w.fx.say('订单雨!', this, this.x, this.z, 120, 50, '#d01a3a');
        if (this.at % Math.round(12 * sp) === 0 && this.at / Math.round(12 * sp) <= n) {
          const tx = Math.random() < 0.4 ? p.x + rand(-10, 10) : rand(camL + 20, camL + W - 20);
          const tz = Math.random() < 0.4 ? p.z : rand(Z_MIN, Z_MAX);
          const pr = new Proj('pin', 'enemy', tx, clamp(tz, Z_MIN, Z_MAX), 200, 0, 0, { dmg: 9, kb: 1.5, zr: 8 }, 300);
          pr.g = 0.18;
          pr.vy = -1;
          w.objs.push(pr);
          audio.sfx('laser', { vol: 0.3 });
        }
        if (this.at > n * 12 * sp + 60) this.nextAct();
        break;
      }
      case 'lasers': {
        if (this.at === 1) {
          w.fx.say('预计送达：00:03', this, this.x, this.z, 120, 60, '#d01a3a');
          const lanes = this.phase === 1 ? 1 : 2;
          const used: number[] = [];
          for (let i = 0; i < lanes; i++) {
            let lz = i === 0 ? p.z : rand(Z_MIN, Z_MAX);
            if (used.some((u) => Math.abs(u - lz) < 20)) lz = clamp(lz + 30, Z_MIN, Z_MAX);
            used.push(lz);
            w.addLaser(lz, 70 + i * 30, 14 + 0);
          }
        }
        if (this.at > 150) this.nextAct();
        break;
      }
      case 'sweep': {
        if (this.at === 1) {
          w.fx.say('全城扫描……', this, this.x, this.z, 120, 60, '#d01a3a');
          w.addSweep(this.phase);
        }
        if (this.at > 170) this.nextAct();
        break;
      }
      case 'summon': {
        if (this.at === 1 && this.puppets.length < 2 && this.coreOpen <= 0) this.summon(w, this.phase + 1);
        if (this.at > 60) this.nextAct();
        break;
      }
    }
    this.eye += (Math.sign(p.x - this.x) * 3 - this.eye) * 0.1;
  }
  nextAct() {
    const seq = ['pins', 'lasers', 'pins', 'sweep', 'lasers', 'summon'];
    this.act = seq[this.pat % seq.length];
    this.pat++;
    this.at = 0;
  }
  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }) {
    if (!this.canBeHit()) return false;
    if (this.shield) {
      audio.sfx('block');
      w.fx.spark(from.x + from.face * 20, this.z, 40, 'sparkRed');
      if (this.t % 2 === 0) w.fx.pop('护盾: 骑手被绑定中!', this.x, this.z, 100, '#ff5a8a', 1, 40, 8);
      w.hitstop(2);
      return false;
    }
    const dmg = Math.round(a.dmg * (this.coreOpen > 0 ? 1.5 : 0.75));
    this.hp -= dmg;
    this.flash = 5;
    this.glitch = Math.max(this.glitch, 6);
    w.onEnemyHit(this, a, dmg);
    if (Math.random() < 0.3) audio.sfx('glitch', { vol: 0.4 });
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      for (const e of w.enemies) if (e !== this && !e.dead) (e as Rider).defeat?.(w, 1);
      w.onBossDefeated(this);
    }
    return true;
  }
  draw(ctx: CanvasRenderingContext2D, camX: number, w: World) {
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 140);
    this.drawBody(ctx, camX);
    ctx.globalAlpha = 1;
  }
  drawBody(ctx: CanvasRenderingContext2D, camX: number) {
    const sx = Math.round(this.x - camX + (this.glitch > 0 ? rand(-3, 3) : 0));
    const base = Math.round(this.z - this.y - this.hover);
    // cables to ground
    ctx.fillStyle = '#1a0a2a';
    for (let i = -3; i <= 3; i++) {
      for (let y = base; y < this.z + 2; y += 2) ctx.fillRect(sx + i * 12 + Math.round(Math.sin(y * 0.1 + i + this.t * 0.05) * 3), y, 2, 2);
    }
    // body: giant monitor
    const bw = 120;
    const bh = 86;
    const bx = sx - bw / 2;
    const by = base - bh;
    ctx.fillStyle = '#100818';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = this.flash > 0 && this.flash % 2 ? '#ffffff' : '#3a2a5a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#5a4a7a';
    ctx.fillRect(bx, by, bw, 3);
    // screen
    const scrC = this.shield ? '#2a0820' : this.coreOpen > 0 ? '#3a0a0a' : '#0a0418';
    ctx.fillStyle = scrC;
    ctx.fillRect(bx + 8, by + 8, bw - 16, bh - 22);
    // scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = by + 8; y < by + bh - 14; y += 2) ctx.fillRect(bx + 8, y, bw - 16, 1);
    // face
    const ec = this.coreOpen > 0 ? '#ffe040' : '#ff2a4a';
    const blink = this.t % 160 < 6;
    const ex = Math.round(this.eye);
    if (!blink) {
      ctx.fillStyle = ec;
      ctx.fillRect(sx - 30 + ex, by + 24, 16, 10);
      ctx.fillRect(sx + 14 + ex, by + 24, 16, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 24 + ex * 2, by + 27, 4, 4);
      ctx.fillRect(sx + 20 + ex * 2, by + 27, 4, 4);
    } else {
      ctx.fillStyle = ec;
      ctx.fillRect(sx - 30, by + 30, 16, 2);
      ctx.fillRect(sx + 14, by + 30, 16, 2);
    }
    // mouth: waveform
    ctx.fillStyle = ec;
    for (let i = 0; i < 40; i++) {
      const h = Math.round(Math.abs(Math.sin(i * 0.7 + this.t * 0.3)) * (this.act === 'pins' ? 7 : 3)) + 1;
      ctx.fillRect(sx - 40 + i * 2, by + 50 - h, 1, h * 2);
    }
    if (this.coreOpen > 0) {
      // exposed core
      const r = 8 + Math.sin(this.t * 0.3) * 2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,200,60,0.5)';
      ctx.beginPath();
      ctx.arc(sx, by + 40, r + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // label
    drawText(ctx, 'ALGO-9000', sx, by + bh - 12, { size: 8, color: '#c08aff', outline: null, align: 'center' });
    // orbiting cctv cams
    for (let i = 0; i < 4; i++) {
      const a = this.t * 0.02 + (i * Math.PI) / 2;
      const cx = sx + Math.cos(a) * 80;
      const cy = by + 40 + Math.sin(a) * 30;
      ctx.fillStyle = '#100818';
      ctx.fillRect(Math.round(cx) - 7, Math.round(cy) - 4, 14, 8);
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(Math.round(cx) - 6, Math.round(cy) - 3, 12, 6);
      ctx.fillStyle = '#ff2a4a';
      ctx.fillRect(Math.round(cx) + (Math.cos(a) > 0 ? -6 : 4), Math.round(cy) - 1, 2, 2);
    }
    // shield
    if (this.shield) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,60,140,${0.5 + Math.sin(this.t * 0.2) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, by + bh / 2, bw / 2 + 14, bh / 2 + 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // tethers to puppets
      ctx.strokeStyle = 'rgba(255,60,140,0.35)';
      ctx.lineWidth = 1;
      for (const r of this.puppets) {
        ctx.beginPath();
        ctx.moveTo(sx, by + bh);
        ctx.lineTo(Math.round(r.x - camX), Math.round(r.z - 50));
        ctx.stroke();
      }
    }
    if (this.glitch > 0) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = pick(['rgba(255,40,100,0.5)', 'rgba(60,240,255,0.5)', 'rgba(255,255,255,0.4)']);
        ctx.fillRect(bx + rand(-10, bw), by + rand(0, bh), rand(10, 50), rand(1, 4));
      }
    }
  }
}

function makeAlgoPortrait(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 22;
  c.height = 22;
  const x = c.getContext('2d')!;
  x.fillStyle = '#3a2a5a';
  x.fillRect(0, 0, 22, 22);
  x.fillStyle = '#0a0418';
  x.fillRect(2, 3, 18, 14);
  x.fillStyle = '#ff2a4a';
  x.fillRect(5, 7, 4, 3);
  x.fillRect(13, 7, 4, 3);
  x.fillRect(6, 13, 10, 1);
  return c;
}
