// Props, pickups and projectiles.
import { audio } from '../core/audio';
import { drawSprite, drawSpriteRot, Sprite } from '../core/gfx';
import { drawText } from '../core/text';
import { ITEMS, PROPS } from '../art/props';
import { Attack, Ent, newAttackId } from './types';
import type { World } from './world';

export type PropKind = 'crate' | 'bin' | 'cone' | 'bike' | 'manhole' | 'warn' | 'car';

export class Prop extends Ent {
  kind: PropKind;
  carried = false;
  drop: string | null;
  breakable: boolean;
  throwable: boolean;
  spr: Sprite;
  shake = 0;
  open = true;
  constructor(kind: PropKind, x: number, z: number, drop: string | null = null, variant = 0) {
    super();
    this.kind = kind;
    this.x = x;
    this.z = z;
    this.drop = drop;
    this.breakable = kind === 'crate' || kind === 'bin';
    this.throwable = kind === 'cone' || kind === 'bike';
    this.hp = this.breakable ? 2 : 1;
    this.hw = kind === 'bike' ? 14 : kind === 'crate' ? 11 : kind === 'car' ? 54 : 7;
    this.hh = kind === 'crate' ? 22 : kind === 'car' ? 30 : 20;
    this.shadow = kind === 'manhole' || kind === 'car' ? 0 : this.hw;
    this.spr =
      kind === 'crate'
        ? PROPS.crate
        : kind === 'bin'
          ? PROPS.bin
          : kind === 'cone'
            ? PROPS.cone
            : kind === 'bike'
              ? [PROPS.bikeY, PROPS.bikeB, PROPS.bikeG][variant % 3]
              : kind === 'warn'
                ? PROPS.warn
                : kind === 'car'
                  ? [PROPS.sportsWhite, PROPS.carWhite, PROPS.carRed, PROPS.carTaxi][variant % 4]
                  : PROPS.manholeOpen;
  }
  canBeHit() {
    return this.breakable && !this.dead;
  }
  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }) {
    if (!this.breakable || this.dead) return false;
    this.hp -= a.kind === 'special' || a.kind === 'super' || a.launch ? 2 : 1;
    this.shake = 8;
    this.flash = 4;
    audio.sfx('break', { vol: 0.6 });
    w.hitstop(3);
    if (this.hp <= 0) this.smash(w);
    return true;
  }
  smash(w: World) {
    if (this.dead) return;
    this.dead = true;
    this.remove = true;
    audio.sfx('break');
    const colors = this.kind === 'crate' ? ['#b47a40', '#7a4a20', '#d8a060'] : ['#2a8a4a', '#4aaa6a', '#e8e8e8'];
    w.fx.burst(this.x, this.z, 10, 14, colors, 2.6, 0.18, 30, 2);
    w.addScore(100);
    if (this.drop) w.objs.push(new Item(this.drop, this.x, this.z));
  }
  alarmT = 0;
  bumps = 0;
  /** parked sports car: hitting it sets off the alarm (it never breaks — it's always there). */
  alarm(w: World, by: 'player' | 'rider' = 'player') {
    if (this.kind !== 'car') return;
    this.shake = 10;
    this.flash = 3;
    w.hitstop(2);
    if (this.alarmT < 150) {
      this.bumps++;
      audio.sfx('alarm', { vol: 0.5, pitch: 1.4 });
      const lines = by === 'rider' ? ['哔嘟哔嘟!', '我的车!!', '赔钱!'] : this.bumps > 4 ? ['车主：你礼貌吗?', '别打了别打了', '哔嘟哔嘟!!'] : ['哔嘟哔嘟!', '呜哇呜哇!', '车主在楼上!'];
      w.fx.pop(lines[Math.floor(Math.random() * lines.length)], this.x, this.z, 46, '#ffb030', 1, 50);
      if (this.bumps <= 5) w.addScore(50);
    }
    this.alarmT = 200;
  }
  update(w: World) {
    if (this.shake > 0) this.shake--;
    if (this.flash > 0) this.flash--;
    if (this.alarmT > 0) {
      this.alarmT--;
      if (this.alarmT % 40 === 0 && this.alarmT > 0) audio.sfx('beep', { vol: 0.25, pitch: this.alarmT % 80 === 0 ? 1.2 : 0.9 });
    }
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    if (this.kind === 'manhole') {
      drawSprite(ctx, this.spr, this.x - camX, this.z);
      return;
    }
    if (this.kind === 'car') {
      const sx = Math.round(this.x - camX + (this.shake ? (this.shake % 2 ? 1 : -1) : 0));
      const sz = Math.round(this.z);
      ctx.fillStyle = 'rgba(10,8,20,0.35)';
      ctx.fillRect(sx - 56, sz - 3, 112, 4);
      drawSprite(ctx, this.spr, sx, sz, this.face < 0, this.flash > 0 && this.flash % 2 === 1);
      if (this.alarmT > 0 && Math.floor(this.alarmT / 6) % 2 === 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,190,40,0.85)';
        ctx.fillRect(sx + 48, sz - 18, 9, 4);
        ctx.fillRect(sx - 59, sz - 16, 8, 4);
        ctx.fillStyle = 'rgba(255,170,40,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx + 52, sz - 16, 14, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(sx - 55, sz - 14, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    const sx = this.x - camX + (this.shake ? (this.shake % 2 ? 1 : -1) : 0);
    drawSprite(ctx, this.spr, sx, this.z - this.y, false, this.flash > 0 && this.flash % 2 === 1);
  }
}

export const ITEM_INFO: Record<string, { name: string; heal?: number; meter?: number; score?: number; life?: boolean }> = {
  sausage: { name: '烤肠', heal: 18 },
  corn: { name: '热玉米', heal: 32 },
  noodle: { name: '肠粉', heal: 60 },
  tea: { name: '奶茶', meter: 100 },
  redpacket: { name: '红包', score: 2000 },
  battery: { name: '满电!', life: true },
};

export class Item extends Ent {
  kind: string;
  t = 0;
  constructor(kind: string, x: number, z: number) {
    super();
    this.kind = kind;
    this.x = x;
    this.z = z;
    this.vy = 2.5;
    this.y = 6;
    this.shadow = 6;
  }
  canBeHit() {
    return false;
  }
  update(w: World) {
    this.t++;
    if (this.y > 0 || this.vy > 0) {
      this.vy -= 0.2;
      this.y = Math.max(0, this.y + this.vy);
      if (this.y === 0) this.vy = 0;
    }
    const p = w.player;
    if (this.t > 12 && Math.abs(p.x - this.x) < 13 && Math.abs(p.z - this.z) < 9 && p.y < 10 && p.hp > 0) {
      const info = ITEM_INFO[this.kind];
      this.remove = true;
      if (info.heal) {
        p.hp = Math.min(p.maxHp, p.hp + info.heal);
        audio.sfx('heal');
        w.fx.pop(`${info.name} +${info.heal}`, this.x, this.z, 50, '#7aff7a', 1, 50);
      }
      if (info.meter) {
        p.meter = Math.min(p.maxMeter, p.meter + info.meter);
        audio.sfx('chargeFull');
        w.fx.pop(`${info.name} 气+1`, this.x, this.z, 50, '#6ad8ff', 1, 50);
      }
      if (info.score) {
        w.addScore(info.score);
        audio.sfx('coin');
        w.fx.pop(`${info.name} +${info.score}`, this.x, this.z, 50, '#ffe040', 1, 50);
      }
      if (info.life) {
        p.lives++;
        audio.sfx('coin');
        w.fx.pop('1UP 满电!', this.x, this.z, 50, '#7aff7a', 1.5, 60);
      }
      w.fx.burst(this.x, this.z, 8, 8, ['#ffffff', '#ffe040'], 1.5, 0.05, 20);
    }
    if (this.t > 900) this.remove = true;
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    if (this.t > 780 && Math.floor(this.t / 4) % 2) return;
    const bob = this.y === 0 ? Math.round(Math.sin(this.t * 0.12) * 1.5) : 0;
    drawSprite(ctx, ITEMS[this.kind], this.x - camX, this.z - this.y - 2 + bob);
    if (this.t % 40 < 6) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(this.x - camX + 4), Math.round(this.z - this.y - 14 + bob), 1, 1);
    }
  }
}

export type ProjKind =
  | 'wave'
  | 'thrownProp'
  | 'cabbage'
  | 'parcel'
  | 'ticket'
  | 'phonecase'
  | 'helmet'
  | 'shout'
  | 'water'
  | 'pin'
  | 'soundwave'
  | 'super';

export class Proj extends Ent {
  kind: ProjKind;
  owner: 'player' | 'enemy';
  atk: Attack;
  life: number;
  g = 0;
  spr: Sprite | null = null;
  rot = 0;
  vrot = 0;
  pierce = false;
  level = 1;
  breakable = false;
  text = '';
  t = 0;
  hitOnce = new Set<Ent>();
  homeBack = false;
  startX = 0;
  constructor(kind: ProjKind, owner: 'player' | 'enemy', x: number, z: number, y: number, vx: number, vy: number, atk: Partial<Attack>, life = 200) {
    super();
    this.kind = kind;
    this.owner = owner;
    this.x = x;
    this.z = z;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.face = Math.sign(vx) || 1;
    this.life = life;
    this.startX = x;
    this.atk = {
      id: newAttackId(),
      dmg: 8,
      kb: 2,
      zr: 10,
      box: [-8, 8, -6, 10],
      kind: 'proj',
      hitstop: 4,
      ...atk,
    };
    this.shadow = 6;
    if (kind === 'cabbage' || kind === 'parcel' || kind === 'ticket' || kind === 'phonecase' || kind === 'helmet' || kind === 'pin') {
      this.spr = PROPS[kind];
      this.vrot = kind === 'pin' ? 0 : 0.25 * this.face;
    }
  }
  canBeHit() {
    return false;
  }
  update(w: World) {
    this.t++;
    this.life--;
    this.x += this.vx;
    this.z += this.vz;
    if (this.g) {
      this.vy -= this.g;
      this.y += this.vy;
    }
    this.rot += this.vrot;
    if (this.kind === 'helmet' && this.t === 40) this.vx = -this.vx; // boomerang
    if (this.kind === 'wave') {
      if (this.t % 2 === 0) w.fx.burst(this.x - this.face * 6, this.z, this.y + 2, 1, ['#6ad8ff', '#ffffff', '#3a8aff'], 0.8, 0, 16, this.level > 1 ? 2 : 1, true);
    }
    if (this.kind === 'water' && this.t % 3 === 0) w.fx.burst(this.x, this.z, 4, 2, ['#8ad0ff', '#ffffff'], 1.2, 0.15, 16);
    // ground hit
    if (this.g && this.y <= 0) {
      this.y = 0;
      if (this.kind === 'pin') {
        w.fx.ring(this.x, this.z, '#ff2a4a', 3, 14);
        w.fx.burst(this.x, this.z, 2, 6, ['#ff2a4a', '#ffffff'], 2);
        audio.sfx('hit', { pitch: 1.6, vol: 0.4 });
        // ground impact AoE
        if (Math.abs(w.player.x - this.x) < 14 && Math.abs(w.player.z - this.z) < 8 && w.player.y < 10) w.player.hurt(w, this.atk, this);
      } else {
        w.fx.burst(this.x, this.z, 2, 6, this.kind === 'cabbage' ? ['#4ab03a', '#8ad86a'] : ['#c89a5a', '#8a6034'], 1.8);
        if (this.kind === 'thrownProp') audio.sfx('crash', { vol: 0.6 });
      }
      this.remove = true;
      return;
    }
    if (this.life <= 0) this.remove = true;
    if (this.x < w.camX - 120 || this.x > w.camX + 600) this.remove = true;
    // collisions
    if (this.owner === 'player') {
      for (const e of w.enemies) {
        if (!e.canBeHit() || this.hitOnce.has(e)) continue;
        if (Math.abs(e.z - this.z) > this.atk.zr) continue;
        if (Math.abs(e.x - this.x) > e.hw + this.atk.box[1]) continue;
        if (this.y + this.atk.box[3] < e.y || this.y + this.atk.box[2] > e.y + e.hh) continue;
        this.hitOnce.add(e);
        const a = { ...this.atk, id: newAttackId(), dir: this.face };
        if (e.hurt(w, a, { x: this.x - this.face * 10, z: this.z, face: this.face })) {
          w.fx.spark(e.x, e.z, 26, a.spark || 'spark');
          if (!this.pierce) {
            this.remove = true;
            if (this.kind === 'wave') {
              w.fx.burst(this.x, this.z, this.y, 16, ['#6ad8ff', '#ffffff', '#3a8aff'], 3, 0.05, 24, 1, true);
              w.fx.ring(this.x, this.z, '#6ad8ff', 4, 14);
            }
            return;
          }
        }
      }
      for (const o of w.objs) {
        if (o instanceof Prop && o.breakable && !o.dead && Math.abs(o.z - this.z) < 10 && Math.abs(o.x - this.x) < o.hw + 8 && this.y < o.hh) {
          o.smash(w);
          if (!this.pierce) this.remove = true;
        }
      }
    } else {
      const p = w.player;
      if (p.canBeHit() && Math.abs(p.z - this.z) <= this.atk.zr && Math.abs(p.x - this.x) < p.hw + this.atk.box[1] && this.y + this.atk.box[3] >= p.y && this.y + this.atk.box[2] <= p.y + p.hh) {
        const a = { ...this.atk, dir: this.face };
        if (p.hurt(w, a, { x: this.x - this.face * 10, z: this.z, face: this.face })) {
          if (!this.pierce) this.remove = true;
        } else if (p.state === 'roll') {
          // dodged through
        }
      }
    }
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.z - this.y);
    if (this.kind === 'wave' || this.kind === 'super') {
      const lv = this.level;
      const r = lv === 1 ? 7 : 12;
      ctx.globalCompositeOperation = 'lighter';
      // trail
      for (let i = 4; i >= 1; i--) {
        ctx.fillStyle = `rgba(60,160,255,${0.08 * i})`;
        ctx.beginPath();
        ctx.ellipse(sx - this.face * i * 5, sy, r + 2 - i, r - i * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(60,170,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, r + 3 + Math.sin(this.t) * 1.5, r + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,240,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(sx + this.face * 2, sy, r - 1, r - 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(sx + this.face * 3, sy, r * 0.45, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (this.kind === 'shout') {
      // a physical speech bubble flying at you
      const w = this.text.length * 12 + 10;
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(sx - w / 2 - 1, sy - 9, w + 2, 18);
      ctx.fillStyle = this.t % 6 < 3 ? '#fff6a0' : '#ffffff';
      ctx.fillRect(sx - w / 2, sy - 8, w, 16);
      drawText(ctx, this.text, sx, sy - 6, { color: '#d01a2a', outline: null, align: 'center' });
      return;
    }
    if (this.kind === 'water') {
      ctx.fillStyle = 'rgba(140,210,255,0.75)';
      ctx.fillRect(sx - 10, sy - 14, 20, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(sx - 10 + ((this.t * 2) % 20), sy - 14, 3, 3);
      ctx.fillRect(sx - 8, sy - 16, 16, 2);
      return;
    }
    if (this.kind === 'soundwave') {
      ctx.strokeStyle = this.t % 4 < 2 ? '#ff3a8a' : '#3af0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx - this.face * 6, sy - 10, 12, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx - this.face * 12, sy - 10, 8, -0.9, 0.9);
      ctx.stroke();
      return;
    }
    if (this.spr) {
      // shadow-target for falling pins
      if (this.kind === 'pin') {
        ctx.fillStyle = 'rgba(255,40,70,0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, Math.round(this.z), 8 + Math.min(8, this.y / 12), 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.vrot) drawSpriteRot(ctx, this.spr, sx, sy, this.rot, this.face < 0, 0);
      else drawSprite(ctx, this.spr, sx, sy, this.face < 0);
    }
  }
}
