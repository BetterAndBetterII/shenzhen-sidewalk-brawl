// The running stage: entities, camera, waves, combat resolution, hazards.
import { audio } from '../core/audio';
import { clamp, drawSprite, H, pick, rand, W } from '../core/gfx';
import { drawText } from '../core/text';
import { save } from '../core/save';
import { Backdrop, CHUNK, drawBackdrop, makeBackdrop, renderChunk, Z_MAX, Z_MIN, CURB_Y } from '../art/backgrounds';
import { PROPS } from '../art/props';
import { Fx } from './fx';
import { Player } from './player';
import { Rider, RiderType } from './enemies';
import { Algo, Boss, Drone } from './boss';
import { Item, Prop, Proj } from './objects';
import { Attack, Ent, newAttackId, overlap } from './types';
import { STAGES, StageDef } from './stages';
import { diff } from './diff';
import { BRANDS } from '../art/riders';
import { Crowd } from './peds';

export interface Session {
  score: number;
  lives: number;
  credits: number; // -1 infinite
  continues: number;
  stage: number;
  totalHits: number;
}

interface Strike {
  x: number;
  z: number;
  t: number;
  delay: number;
  kind: string;
  dmg: number;
}
interface Laser {
  z: number;
  t: number;
  warn: number;
  dur: number;
}
interface Shock {
  x: number;
  z: number;
  r: number;
  color: string;
  dmg: number;
  hit: boolean;
}
interface Sweep {
  x: number;
  dir: number;
  t: number;
  speed: number;
}
interface Car {
  x: number;
  vx: number;
  spr: number;
  y: number;
}

export type Flow = 'intro' | 'play' | 'bossIntro' | 'bossDead' | 'clear' | 'continue' | 'done';

export class World {
  stage: StageDef;
  session: Session;
  bd: Backdrop;
  player: Player;
  enemies: Ent[] = [];
  objs: Ent[] = [];
  fx = new Fx();
  camX = 0;
  flow: Flow = 'intro';
  flowT = 0;
  segIdx = 0;
  segActive = false;
  groupIdx = 0;
  spawnQueue: { type: RiderType; side: number; z: number; delay: number }[] = [];
  hs = 0;
  shakeAmt = 0;
  shakeX = 0;
  shakeY = 0;
  flashT = 0;
  flashColor = '#ffffff';
  slowT = 0;
  slowAcc = 0;
  superT = 0;
  superBy: Player | null = null;
  timer = 99;
  timerF = 0;
  combo = 0;
  comboT = 0;
  maxCombo = 0;
  enemyInfo: { e: Ent; t: number } | null = null;
  boss: Ent | null = null;
  bossCard = 0;
  goArrow = 0;
  strikes: Strike[] = [];
  lasers: Laser[] = [];
  shocks: Shock[] = [];
  sweeps: Sweep[] = [];
  laneWarn: { z: number; t: number; dur: number }[] = [];
  cars: Car[] = [];
  rainDrops: { x: number; y: number; l: number }[] = [];
  lightning = 0;
  sprinkler: { x: number; t: number } | null = null;
  sprinklerCd = 900;
  calmed = 0;
  frames = 0;
  stageScore = 0;
  events: string[] = [];
  bossDefeatT = 0;
  tutorial = 0;
  stageStartScore = 0;
  timeBonusT = 0;
  crowd: Crowd | null = null;

  constructor(stageIdx: number, session: Session) {
    this.stage = STAGES[stageIdx];
    this.session = session;
    this.bd = makeBackdrop(this.stage.theme, this.stage.length);
    // pre-render chunks to avoid hitches
    for (let i = -1; i <= Math.ceil(this.stage.length / CHUNK) + 1; i++) this.bd.chunks.set(i, renderChunk(this.bd.theme, i, this.bd.plan));
    this.player = new Player();
    this.player.x = -30;
    this.player.z = 196;
    this.player.lives = session.lives;
    this.player.setState('auto');
    this.player.autoTarget = 90;
    for (const [kind, x, z, drop, variant] of this.stage.props) this.objs.push(new Prop(kind, x, z, drop ?? null, variant ?? 0));
    if (this.stage.rain) for (let i = 0; i < 120; i++) this.rainDrops.push({ x: rand(0, W), y: rand(0, H), l: rand(4, 9) });
    this.tutorial = stageIdx === 0 ? 600 : 0;
    this.stageStartScore = session.score;
    if (this.stage.theme !== 'void') this.crowd = new Crowd(this.stage.rain ? 3 : 6, 0);
  }

  // ---------------- API for entities ----------------
  controlEnabled() {
    return this.flow === 'play' || this.flow === 'bossIntro';
  }
  hitstop(n: number) {
    this.hs = Math.max(this.hs, n);
  }
  shake(n: number) {
    if (!save.settings.shake) return;
    this.shakeAmt = Math.max(this.shakeAmt, n);
  }
  flash(n: number, color = '#ffffff') {
    this.flashT = Math.max(this.flashT, n);
    this.flashColor = color;
  }
  resetCombo() {
    this.combo = 0;
    this.comboT = 0;
  }
  addTime(n: number) {
    this.timer = Math.min(99, this.timer + n);
    this.timeBonusT = 60;
  }
  addScore(n: number) {
    this.session.score += Math.round(n);
    if (this.session.score > save.highScore) save.highScore = this.session.score;
  }
  clampToCamera(e: Ent) {
    const lo = this.camX + 12;
    const hi = this.camX + W - 12;
    if (this.flow === 'intro' || this.player.state === 'auto') return;
    e.x = clamp(e.x, lo, hi);
  }
  clearNear(x: number, r: number) {
    for (const o of this.objs) if (o instanceof Proj && o.owner === 'enemy' && Math.abs(o.x - x) < r) o.remove = true;
    this.fx.ring(this.player.x, this.player.z, '#ffffff', 5, 18);
  }
  grabbable(p: Player): Ent | null {
    for (const e of this.enemies) {
      if (!(e instanceof Rider) || e.isBoss || e.dead) continue;
      if (e.state !== 'dizzy') continue;
      if (Math.abs(e.z - p.z) < 10 && (e.x - p.x) * p.face > 0 && Math.abs(e.x - p.x) < 30) return e;
    }
    return null;
  }
  pickupable(p: Player): Ent | null {
    // only when no enemy is right in front
    for (const e of this.enemies) if (!e.dead && Math.abs(e.z - p.z) < 12 && Math.abs(e.x - p.x) < 36) return null;
    for (const o of this.objs) {
      if (o instanceof Prop && o.throwable && !o.carried && !o.dead && Math.abs(o.x - p.x) < 18 && Math.abs(o.z - p.z) < 10) return o;
    }
    return null;
  }

  playerAttack(p: Player, a: Attack) {
    let hits = 0;
    for (const e of this.enemies) {
      if (!e.canBeHit() || e.hitIds.has(a.id)) continue;
      if (!overlap(p.x, p.face, a, p.y, p.z, e)) continue;
      e.hitIds.add(a.id);
      if (e.hitIds.size > 40) e.hitIds.clear(), e.hitIds.add(a.id);
      if (e.hurt(this, a, p)) {
        hits++;
        const cx = (p.x + p.face * a.box[1] * 0.6 + e.x) / 2;
        const cy = p.y + (a.box[2] + a.box[3]) / 2;
        this.fx.spark(cx, e.z + 0.5, cy, a.spark || 'spark');
        this.fx.burst(cx, e.z, cy, a.launch ? 10 : 5, a.kind === 'special' ? ['#6ad8ff', '#ffffff', '#3a8aff'] : ['#ffe860', '#ffffff', '#ffb030'], a.launch ? 3 : 2, 0.12, 18, 1, a.kind === 'special');
        audio.sfx(a.launch || a.kind === 'special' ? 'hitHeavy' : 'hit', { pitch: 0.9 + Math.random() * 0.2 + Math.min(0.4, this.combo * 0.02) });
        this.hitstop(a.hitstop ?? 4);
        this.shake(a.kind === 'special' ? 7 : a.launch ? 4 : 2);
        if (a.launch && Math.random() < 0.5) this.fx.pop(pick(['嘭!', '砰!', '啪!', '咚!', '哐!']), cx, e.z, cy + 16, '#ffffff', 1, 26);
        if (a.kind === 'special') this.flash(3, '#bfefff');
      }
    }
    for (const o of this.objs) {
      if (o instanceof Prop && o.kind === 'car' && !o.hitIds.has(a.id) && overlap(p.x, p.face, a, p.y, p.z, { x: o.x, y: 0, hw: o.hw, hh: o.hh, z: p.z } as unknown as Ent) && Math.abs(o.z - p.z) < 24) {
        o.hitIds.add(a.id);
        if (o.hitIds.size > 30) o.hitIds.clear();
        o.alarm(this);
        this.fx.spark(p.x + p.face * 20, p.z, 18);
      }
      if (o instanceof Prop && o.breakable && !o.dead && !o.hitIds.has(a.id) && overlap(p.x, p.face, a, p.y, p.z, o)) {
        o.hitIds.add(a.id);
        o.hurt(this, a, p);
        this.fx.spark(o.x, o.z, 14);
      }
      if (o instanceof Proj && o.owner === 'enemy' && o.breakable && !o.remove) {
        const fake = { x: o.x, z: o.z, y: o.y - 8, hw: 14, hh: 18 } as Ent;
        if (overlap(p.x, p.face, a, p.y, p.z, fake)) {
          o.remove = true;
          this.fx.burst(o.x, o.z, o.y, 12, ['#ffffff', '#fff6a0', '#d01a2a'], 2.5);
          this.fx.pop('打碎!', o.x, o.z, o.y + 14, '#ffe040', 1, 30, 8);
          audio.sfx('break');
          this.addScore(100);
          this.hitstop(3);
        }
      }
    }
    return hits;
  }

  onEnemyHit(e: Ent, a: Attack, dmg: number) {
    this.combo++;
    this.comboT = 110;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.session.totalHits++;
    this.addScore(dmg * 10 * (1 + Math.min(2, this.combo * 0.05)));
    if (a.kind !== 'special' && a.kind !== 'super') this.player.meter = Math.min(this.player.maxMeter, this.player.meter + 4);
    this.enemyInfo = { e, t: 160 };
    if (this.combo > 0 && this.combo % 10 === 0) this.fx.pop(`${this.combo} 连击!`, this.player.x, this.player.z, 70, '#ff8a3a', 1.5, 50);
  }
  onEnemyDefeated(e: Ent) {
    this.calmed++;
    const r = e as Rider;
    const sc = r.def ? r.def.score : 500;
    this.addScore(sc);
    this.fx.pop(`+${sc}`, e.x, e.z, 50, '#ffe040', 1, 40, 8);
    this.fx.pop(pick(['订单已送达', '平稳送达', '已减速', '冷静下来了', '安全第一', '订单已送达']), e.x, e.z, 64, '#7affb0', 1, 50, 8);
    this.hitstop(8);
    this.shake(5);
    if (Math.random() < 0.12) this.objs.push(new Item(pick(['sausage', 'corn', 'tea']), e.x, e.z));
  }
  onBossDefeated(b: Ent) {
    this.flow = 'bossDead';
    this.flowT = 0;
    this.slowT = 90;
    this.flash(12);
    this.shake(12);
    audio.sfx('ko');
    audio.fadeMusic();
    this.addScore(10000);
    // calm all remaining riders
    for (const e of this.enemies) if (e !== b && !e.dead && e instanceof Rider) e.defeat(this, 1);
    for (const e of this.enemies) if (e instanceof Drone) e.remove = true;
    for (const o of this.objs) if (o instanceof Proj && o.owner === 'enemy') o.remove = true;
    this.strikes.length = 0;
    this.lasers.length = 0;
    this.sweeps.length = 0;
    this.shocks.length = 0;
  }
  bossIntroDone(b: Ent) {
    if (this.flow === 'bossIntro') this.flow = 'play';
  }
  playerDied() {
    const p = this.player;
    this.session.lives = p.lives;
    if (p.lives > 1) {
      p.lives--;
      this.session.lives = p.lives;
      this.respawnPlayer();
    } else {
      p.lives = 0;
      this.session.lives = 0;
      this.flow = 'continue';
      this.flowT = 0;
      audio.playMusic('gameover');
    }
  }
  respawnPlayer() {
    const p = this.player;
    p.hp = p.maxHp;
    p.displayHp = p.maxHp;
    p.meter = Math.max(p.meter, 100);
    p.x = clamp(p.x, this.camX + 60, this.camX + W - 60);
    p.y = 120;
    p.vy = 0;
    p.vx = 0;
    p.setState('respawn');
    p.invuln = 120;
    this.timer = 99;
  }
  continueGame() {
    const p = this.player;
    p.lives = diff().lives;
    this.session.lives = p.lives;
    this.session.continues++;
    if (this.session.credits > 0) this.session.credits--;
    this.session.score = Math.floor(this.session.score / 10) * 10 + 1; // arcade style continue mark
    this.flow = 'play';
    this.respawnPlayer();
    audio.playMusic(this.boss ? (this.stage.boss === 'algo' ? 'final' : 'boss') : this.stage.music);
  }

  spawnRider(type: RiderType, side: number, z: number, delay = 0): Rider | null {
    if (delay > 0) {
      this.spawnQueue.push({ type, side, z, delay });
      return null;
    }
    const r = new Rider(type, side, z, this);
    if (this.stage.theme === 'void') {
      r.brand = BRANDS.algo;
      r.name = '被绑定的骑手';
      r.defeatQuotes = ['我…为什么在这?', '谢谢你…把我叫醒', '终于不用抢单了', '原来我被绑定了…', '头盔里一直在催单…'];
    }
    this.enemies.push(r);
    return r;
  }

  enemyThrow(r: Rider, kind: 'parcel' | 'cabbage', power = 1) {
    const p = this.player;
    const dx = p.x - r.x;
    const T = 40;
    const pr = new Proj(kind, 'enemy', r.x + r.face * 8, r.z, 40 * r.scale, dx / T, 0, { dmg: kind === 'parcel' ? 9 * power : 7, kb: 1.5, box: [-8, 8, -8, 10] });
    pr.g = 0.2;
    pr.vy = (0 - 40 * r.scale + 0.5 * 0.2 * T * T) / T;
    pr.vz = (p.z - r.z) / T;
    this.objs.push(pr);
    audio.sfx('throw');
  }

  spawnWave(p: Player, lv: number) {
    const pr = new Proj('wave', 'player', p.x + p.face * 22, p.z, 30, p.face * (lv === 1 ? 4.6 : 5.2), 0, {
      dmg: lv === 1 ? 20 : 34,
      kb: lv === 1 ? 4 : 6,
      launch: true,
      stun: 50,
      hitstop: 8,
      kind: 'special',
      spark: 'sparkBlue',
      zr: lv === 1 ? 12 : 16,
      box: [-10, 10, -14, 16],
    });
    pr.level = lv;
    pr.pierce = lv >= 2;
    this.objs.push(pr);
    this.shake(lv * 3);
    this.flash(3, '#9adfff');
    this.fx.ring(p.x + p.face * 22, p.z, '#6ad8ff', 4, 14);
    this.fx.pop(lv === 1 ? '龙华波动拳!' : '真·龙华波动拳!', p.x, p.z, 64, '#9ae0ff', lv === 1 ? 1 : 1.5, 50);
  }

  startSuper(p: Player) {
    this.superT = 1;
    this.superBy = p;
    audio.sfx('super');
    this.flash(6, '#ffffff');
  }

  perfectDodge(p: Player) {
    this.slowT = 40;
    p.meter = Math.min(p.maxMeter, p.meter + 40);
    this.fx.pop('完美闪避!', p.x, p.z, 64, '#7affff', 1.5, 50);
    this.addScore(300);
    audio.sfx('perfect');
    this.flash(2, '#c0ffff');
    for (const e of this.enemies) if (e instanceof Boss && e.act === 'charge' && e.sub === 2) e.dodgedThisCharge = true;
  }

  hitGrabbed(p: Player, g: Ent, a: Attack) {
    if (g instanceof Rider) {
      g.hp -= a.dmg;
      g.flash = 5;
      this.onEnemyHit(g, a, a.dmg);
      this.fx.spark(g.x, g.z, 30);
      audio.sfx('hit');
      this.hitstop(4);
      this.shake(2);
      if (g.hp <= 0) {
        p.releaseGrab();
        p.setState('idle');
        g.defeat(this, p.face);
      }
    }
  }
  throwGrabbed(p: Player, g: Ent) {
    if (!(g instanceof Rider)) return;
    g.grabbedBy = null;
    g.setState('thrown');
    g.vx = p.face * 4.2;
    g.vy = 2.6;
    g.y = 30;
    g.face = p.face;
    g.thrownAtk = { id: newAttackId(), dmg: 22, kb: 4, launch: true, zr: 14, box: [-16, 16, 0, 30], kind: 'throw', hitstop: 6 };
    audio.sfx('throw');
    this.fx.pop('过肩摔!', p.x, p.z, 66, '#ffe040', 1.5, 40);
    this.shake(4);
  }
  thrownHits(r: Rider, a: Attack) {
    for (const e of this.enemies) {
      if (e === r || !e.canBeHit() || e.hitIds.has(a.id)) continue;
      if (Math.abs(e.z - r.z) < a.zr && Math.abs(e.x - r.x) < e.hw + 16) {
        e.hitIds.add(a.id);
        if (e.hurt(this, { ...a, dir: r.face }, r)) {
          this.fx.spark(e.x, e.z, 26, 'spark');
          audio.sfx('hitHeavy');
          this.hitstop(5);
        }
      }
    }
    for (const o of this.objs) if (o instanceof Prop && o.breakable && !o.dead && Math.abs(o.z - r.z) < 12 && Math.abs(o.x - r.x) < 18) o.smash(this);
  }
  throwProp(p: Player, c: Ent) {
    const prop = c as Prop;
    prop.remove = true;
    const pr = new Proj('thrownProp', 'player', p.x + p.face * 10, p.z, 40, p.face * 5, 1.2, {
      dmg: prop.kind === 'bike' ? 20 : 14,
      kb: 4,
      launch: true,
      stun: 40,
      hitstop: 6,
      kind: 'throw',
      zr: 12,
      box: [-14, 14, -20, 10],
    });
    pr.g = 0.12;
    pr.spr = prop.spr;
    pr.vrot = prop.kind === 'bike' ? 0 : 0.3 * p.face;
    pr.pierce = prop.kind === 'bike';
    this.objs.push(pr);
  }

  telegraphLane(z: number, dur: number) {
    this.laneWarn.push({ z, t: 0, dur });
  }
  shockwave(x: number, z: number, color: string, dmg: number) {
    this.shocks.push({ x, z, r: 6, color, dmg, hit: false });
  }
  addStrike(x: number, z: number, kind: string, delay: number, dmg: number) {
    this.strikes.push({ x, z, t: 0, delay, kind, dmg });
  }
  addLaser(z: number, warn: number, dur: number) {
    this.lasers.push({ z, t: 0, warn, dur });
  }
  addSweep(phase: number) {
    const fromLeft = this.player.x > this.camX + W / 2;
    this.sweeps.push({ x: fromLeft ? this.camX - 10 : this.camX + W + 10, dir: fromLeft ? 1 : -1, t: 0, speed: 2.2 + phase * 0.5 });
  }

  // ---------------- flow ----------------
  currentLockMax(): number {
    const segs = this.stage.segments;
    const end = this.stage.length - W;
    if (this.segActive) return segs[this.segIdx].at;
    if (this.segIdx < segs.length) return segs[this.segIdx].at;
    return end;
  }

  startSegment() {
    this.segActive = true;
    this.groupIdx = 0;
    this.timer = 99;
    this.spawnGroup();
  }
  spawnGroup() {
    const seg = this.stage.segments[this.segIdx];
    const grp = seg.groups[this.groupIdx];
    if (!grp) return;
    const types = [...grp.types];
    const extra = diff().maxActive;
    if (extra > 0 && this.groupIdx === seg.groups.length - 1) for (let i = 0; i < extra; i++) types.push(pick(['cruiser', 'weaver'] as RiderType[]));
    if (extra < 0 && types.length > 2) types.pop();
    types.forEach((t, i) => {
      const side = i % 2 === 0 ? (Math.random() < 0.5 ? 1 : -1) : -1 * (Math.random() < 0.5 ? 1 : -1);
      this.spawnRider(t, side, rand(Z_MIN + 6, Z_MAX - 6), i * 50 + 10);
    });
    this.groupIdx++;
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead).length + this.spawnQueue.length;
  }

  startBoss() {
    this.flow = 'bossIntro';
    this.flowT = 0;
    this.timer = 99;
    const id = this.stage.boss;
    this.boss = id === 'algo' ? new Algo(this) : new Boss(id, this);
    this.enemies.push(this.boss);
    this.bossCard = 150;
    audio.playMusic(id === 'algo' ? 'final' : 'boss');
    audio.sfx('alarm');
    if (this.boss instanceof Boss) this.fx.say((this.boss as Boss).bdef.intro, this.boss, this.boss.x, this.boss.z, 70 * (this.boss as Boss).scale, 140);
    else this.fx.say('检测到异常用户：阿龙。开始优化。', this.boss, this.boss.x, this.boss.z, 120, 160, '#d01a3a');
  }

  // ---------------- main update ----------------
  update() {
    this.frames++;
    this.flowT++;
    if (this.shakeAmt > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt * 2;
      this.shakeAmt *= 0.85;
      if (this.shakeAmt < 0.4) this.shakeAmt = 0;
    } else this.shakeX = this.shakeY = 0;
    if (this.flashT > 0) this.flashT--;
    if (this.bossCard > 0) this.bossCard--;
    this.updateAmbient();

    if (this.flow === 'continue') {
      this.fx.update();
      return;
    }
    if (this.hs > 0) {
      this.hs--;
      return;
    }
    // super cinematic freezes everything but the player pose
    if (this.superT > 0) {
      this.superT++;
      const p = this.superBy!;
      p.t++;
      p.anim++;
      p.pickSprite();
      if (this.superT === 36) {
        this.flash(10, '#ffffff');
        this.shake(14);
        audio.sfx('blast');
        for (const e of this.enemies) {
          if (!e.canBeHit()) continue;
          if (e.x < this.camX - 20 || e.x > this.camX + W + 20) continue;
          const a: Attack = { id: newAttackId(), dmg: 55, kb: 6, launch: true, stun: 80, hitstop: 0, zr: 999, box: [-999, 999, -99, 999], kind: 'super', spark: 'sparkBlue', dir: Math.sign(e.x - p.x) || 1 };
          if (e.hurt(this, a, p)) this.fx.spark(e.x, e.z, 30, 'sparkBlue');
        }
        for (const o of this.objs) if (o instanceof Proj && o.owner === 'enemy') o.remove = true;
        for (const o of this.objs) if (o instanceof Prop && o.breakable && o.x > this.camX && o.x < this.camX + W) o.smash(this);
      }
      if (this.superT > 70) {
        this.superT = 0;
        p.setState('idle');
        p.invuln = 30;
      }
      this.fx.update();
      return;
    }
    // slow motion
    if (this.slowT > 0) {
      this.slowT--;
      this.slowAcc += 0.4;
      if (this.slowAcc < 1) {
        this.fx.update();
        return;
      }
      this.slowAcc -= 1;
    }
    this.step();
  }

  private step() {
    const p = this.player;
    // flow transitions
    if (this.flow === 'intro') {
      if (p.x >= p.autoTarget - 2 || this.flowT > 200) {
        p.setState('idle');
        this.flow = 'play';
        this.flowT = 0;
      }
    }
    if (this.flow === 'bossDead') {
      this.bossDefeatT++;
      if (this.flowT > 150 && this.enemies.every((e) => e.dead || e.remove)) {
        this.flow = 'clear';
        this.flowT = 0;
        p.setState('victory');
        audio.playMusic('clear');
      }
    }
    if (this.flow === 'clear' && this.flowT > 230) {
      this.flow = 'done';
      this.events.push('clear');
    }

    // spawn queue
    for (const s of this.spawnQueue) s.delay--;
    const ready = this.spawnQueue.filter((s) => s.delay <= 0);
    this.spawnQueue = this.spawnQueue.filter((s) => s.delay > 0);
    for (const s of ready) this.spawnRider(s.type, s.side, s.z, 0);

    // waves
    if (this.flow === 'play' && !this.boss) {
      const segs = this.stage.segments;
      if (!this.segActive && this.segIdx < segs.length && this.camX >= segs[this.segIdx].at - 1) this.startSegment();
      if (this.segActive) {
        const seg = segs[this.segIdx];
        const alive = this.aliveEnemies();
        if (this.groupIdx < seg.groups.length && alive <= Math.max(0, 1 + Math.min(0, diff().maxActive))) this.spawnGroup();
        if (this.groupIdx >= seg.groups.length && alive === 0) {
          this.segActive = false;
          this.segIdx++;
          this.goArrow = 180;
          audio.sfx('go');
          this.addScore(1000);
          this.timer = 99;
        }
      }
      if (this.segIdx >= segs.length && !this.segActive && this.camX >= this.stage.length - W - 1) this.startBoss();
    }

    // timer
    if ((this.flow === 'play' || this.flow === 'bossIntro') && p.state !== 'dead') {
      this.timerF++;
      // boss fights tick slower so a long duel isn't decided by the clock
      if (this.timerF >= (this.boss ? 110 : 75)) {
        this.timerF = 0;
        this.timer--;
        if (this.timer <= 10 && this.timer > 0) audio.sfx('beep');
        if (this.timer <= 0) {
          this.fx.pop('超时!!', p.x, p.z, 70, '#ff3a3a', 2, 80);
          audio.sfx('alarm');
          p.hp = 0;
          p.setState('fall');
          p.vy = 3;
          p.y = 1;
          this.timer = 99;
        }
      }
    }
    if (this.tutorial > 0) this.tutorial--;
    if (this.goArrow > 0) this.goArrow--;
    if (this.timeBonusT > 0) this.timeBonusT--;
    if (this.comboT > 0) {
      this.comboT--;
      if (this.comboT === 0) this.combo = 0;
    }
    if (this.enemyInfo) {
      this.enemyInfo.t--;
      if (this.enemyInfo.t <= 0 || (this.enemyInfo.e.dead && this.enemyInfo.t > 40)) this.enemyInfo.t = Math.min(this.enemyInfo.t, 40);
      if (this.enemyInfo.t <= 0) this.enemyInfo = null;
    }

    // slippery floor (rain)
    const prevVx = p.vx;
    p.update(this);
    if (this.stage.slippery && ['walk', 'run', 'idle'].includes(p.state)) {
      const nv = prevVx + (p.vx - prevVx) * 0.18;
      p.x += nv - p.vx;
      p.vx = nv;
      if (Math.abs(nv) > 1.5 && this.frames % 6 === 0) this.fx.burst(p.x, p.z, 1, 2, ['#8ad0ff', '#ffffff'], 1, 0.1, 12);
    }

    for (const e of this.enemies) e.update(this);
    for (const o of this.objs) o.update(this);
    this.enemies = this.enemies.filter((e) => !e.remove);
    for (const o of this.enemies) if (o.dead && o instanceof Rider) o.remove = true;
    this.objs = this.objs.filter((o) => !o.remove);

    this.updateHazards();

    // camera
    if (this.flow !== 'intro') {
      const lockMax = this.boss ? this.camX : this.currentLockMax();
      const target = clamp(p.x - W * 0.42, 0, Math.max(0, lockMax));
      if (target > this.camX) this.camX += Math.min(3, (target - this.camX) * 0.12 + 0.3);
      this.camX = Math.min(this.camX, Math.max(0, this.stage.length - W));
    }

    this.fx.update();
  }

  private updateHazards() {
    const p = this.player;
    // manholes
    for (const o of this.objs) {
      if (!(o instanceof Prop) || o.kind !== 'manhole') continue;
      if (Math.abs(p.x - o.x) < 9 && Math.abs(p.z - o.z) < 4 && p.y === 0 && ['idle', 'walk', 'run', 'hurt'].includes(p.state) && p.invuln <= 0) {
        p.setState('fallHole');
        p.x = o.x;
        p.z = o.z;
        audio.sfx('jump', { pitch: 0.5 });
        this.fx.pop('掉坑了!', o.x, o.z, 40, '#ff8a3a', 1, 50);
      }
      for (const e of this.enemies) {
        if (!(e instanceof Rider) || e.isBoss || e.dead) continue;
        if (Math.abs(e.x - o.x) < 7 && Math.abs(e.z - o.z) < 5 && ['enter', 'cruise', 'dash'].includes(e.state)) {
          this.fx.pop('掉坑了! +800', o.x, o.z, 60, '#ffe040', 1, 60);
          this.addScore(800);
          e.defeat(this, e.dir);
        }
      }
    }
    // knocked riders crash into crates
    for (const e of this.enemies) {
      if (!(e instanceof Rider) || (e.state !== 'knock' && e.state !== 'thrown')) continue;
      for (const o of this.objs) {
        if (o instanceof Prop && o.breakable && !o.dead && Math.abs(o.z - e.z) < 12 && Math.abs(o.x - e.x) < 20) {
          o.smash(this);
          this.fx.pop('哐当!', o.x, o.z, 30, '#ffffff', 1, 30);
        }
        if (o instanceof Prop && o.kind === 'car' && o.alarmT < 150 && Math.abs(o.z - e.z) < 22 && Math.abs(o.x - e.x) < o.hw) o.alarm(this, 'rider');
      }
    }
    // strikes
    for (const s of this.strikes) {
      s.t++;
      if (s.t === s.delay) {
        this.flash(3, s.kind === 'emp' ? '#c0a0ff' : '#ffffff');
        this.shake(5);
        audio.sfx(s.kind === 'emp' ? 'laser' : 'thunder');
        this.fx.burst(s.x, s.z, 4, 14, s.kind === 'emp' ? ['#c08aff', '#ffffff', '#3af0ff'] : ['#ffffff', '#fff6a0', '#8ad0ff'], 3, 0.1, 22, 1, true);
        if (Math.abs(p.x - s.x) < 18 && Math.abs(p.z - s.z) < 10) {
          p.hurt(this, { id: newAttackId(), dmg: s.dmg, kb: 2.5, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', hitstop: 6, dir: Math.sign(p.x - s.x) || 1 }, { x: s.x, z: s.z, face: 1 });
        }
      }
    }
    this.strikes = this.strikes.filter((s) => s.t < s.delay + 14);
    // lasers
    for (const l of this.lasers) {
      l.t++;
      if (l.t === l.warn) {
        audio.sfx('laser');
        this.shake(4);
      }
      if (l.t >= l.warn && l.t < l.warn + l.dur) {
        if (Math.abs(p.z - l.z) < 9) {
          p.hurt(this, { id: newAttackId(), dmg: 14, kb: 3, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', hitstop: 6, dir: p.face * -1 }, { x: p.x + p.face * 10, z: l.z, face: -p.face });
        }
      }
    }
    this.lasers = this.lasers.filter((l) => l.t < l.warn + l.dur + 4);
    // shockwave rings: jump over them
    for (const s of this.shocks) {
      s.r += 3.2;
      const d = Math.hypot(p.x - s.x, (p.z - s.z) * 2.6);
      if (!s.hit && Math.abs(d - s.r) < 5 && p.y < 6) {
        s.hit = true;
        p.hurt(this, { id: newAttackId(), dmg: s.dmg, kb: 2.5, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', hitstop: 5, dir: Math.sign(p.x - s.x) || 1 }, { x: s.x, z: s.z, face: 1 });
      }
    }
    this.shocks = this.shocks.filter((s) => s.r < 240);
    // sweeps
    for (const s of this.sweeps) {
      s.t++;
      if (s.t > 50) s.x += s.dir * s.speed;
      if (s.t > 50 && Math.abs(p.x - s.x) < 7 && p.y < 12) {
        p.hurt(this, { id: newAttackId(), dmg: 13, kb: 3, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', hitstop: 6, dir: s.dir }, { x: s.x - s.dir, z: p.z, face: s.dir });
      }
    }
    this.sweeps = this.sweeps.filter((s) => s.t < 400 && s.x > this.camX - 40 && s.x < this.camX + W + 40);
    for (const l of this.laneWarn) l.t++;
    this.laneWarn = this.laneWarn.filter((l) => l.t < l.dur);
    // sprinkler truck (深南大道)
    if (this.stage.sprinkler && this.flow === 'play') {
      if (!this.sprinkler) {
        this.sprinklerCd--;
        if (this.sprinklerCd <= 0) {
          this.sprinkler = { x: this.camX + W + 80, t: 0 };
          this.sprinklerCd = 1300 + Math.floor(rand(0, 600));
          this.fx.pop('♪ 洒水车来了 ♪ 靠里走!', this.camX + W / 2, Z_MIN + 10, 70, '#7ad8ff', 1, 120);
          this.playSprinklerTune();
        }
      } else {
        const s = this.sprinkler;
        s.t++;
        if (s.t > 90) s.x -= 2.6;
        if (s.t > 90 && s.t % 3 === 0) this.fx.burst(s.x - 30, Z_MAX, 6, 3, ['#8ad0ff', '#ffffff'], 2.5, 0.15, 20);
        if (s.t > 90 && Math.abs(p.x - (s.x - 30)) < 24 && p.z > Z_MAX - 26 && p.y < 8) {
          p.hurt(this, { id: newAttackId(), dmg: 8, kb: 2, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', dir: 1, hitstop: 3 }, { x: s.x - 50, z: p.z, face: 1 });
        }
        for (const e of this.enemies) {
          if (e instanceof Rider && !e.isBoss && e.canBeHit() && e.z > Z_MAX - 26 && Math.abs(e.x - (s.x - 30)) < 24 && !e.hitIds.has(-77)) {
            e.hitIds.add(-77);
            e.hurt(this, { id: newAttackId(), dmg: 12, kb: 3, launch: true, zr: 99, box: [0, 0, 0, 0], kind: 'hazard', dir: -1 }, { x: s.x, z: e.z, face: -1 });
          }
        }
        if (s.x < this.camX - 160) this.sprinkler = null;
      }
    }
  }

  playSprinklerTune() {
    // the famous singing sprinkler trucks of Shenzhen (an original little tune)
    const notes = [67, 67, 69, 67, 72, 71, 67, 67, 69, 67, 74, 72];
    const ctx = audio.ctx;
    if (!ctx) return;
    notes.forEach((n, i) => audio.tone('sq12', 440 * Math.pow(2, (n - 69) / 12), ctx.currentTime + 0.05 + i * 0.16, 0.15, 0.06, false));
  }

  private updateAmbient() {
    this.crowd?.update(this);
    // traffic on the road
    if (this.stage.traffic && Math.random() < 0.006 && this.cars.length < 2) {
      const left = Math.random() < 0.5;
      this.cars.push({ x: left ? this.camX - 120 : this.camX + W + 120, vx: left ? rand(2.5, 4) : -rand(2.5, 4), spr: Math.floor(rand(0, 3)), y: left ? 262 : 266 });
    }
    for (const c of this.cars) c.x += c.vx;
    this.cars = this.cars.filter((c) => c.x > this.camX - 200 && c.x < this.camX + W + 200);
    if (this.stage.rain) {
      for (const d of this.rainDrops) {
        d.y += 7;
        d.x -= 2;
        if (d.y > H) {
          d.y = rand(-20, 0);
          d.x = rand(0, W + 60);
        }
      }
      if (this.lightning > 0) this.lightning--;
      if (Math.random() < 0.002) {
        this.lightning = 12;
        setTimeout(() => audio.sfx('thunder'), 300);
      }
    }
  }

  // ---------------- draw ----------------
  draw(ctx: CanvasRenderingContext2D) {
    const camX = Math.round(this.camX + this.shakeX);
    ctx.save();
    ctx.translate(0, Math.round(this.shakeY));
    drawBackdrop(ctx, this.bd, camX);
    if (this.stage.theme === 'void') {
      // dim the noisy data-center backdrop so fighters and bullets stay readable
      ctx.fillStyle = 'rgba(6,0,18,0.38)';
      ctx.fillRect(0, 0, W, H);
      this.drawVoidFx(ctx);
    }
    this.crowd?.draw(ctx, camX);
    // lane warnings & ground telegraphs
    for (const l of this.laneWarn) {
      if (Math.floor(l.t / 3) % 2) continue;
      ctx.fillStyle = 'rgba(255,60,40,0.4)';
      ctx.fillRect(0, Math.round(l.z - 4), W, 8);
    }
    for (const l of this.lasers) {
      if (l.t < l.warn) {
        if (Math.floor(l.t / 4) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,40,90,0.35)';
          ctx.fillRect(0, Math.round(l.z - 8), W, 16);
        }
        const secs = Math.max(0, Math.ceil(((l.warn - l.t) / l.warn) * 3));
        drawText(ctx, `预计送达 00:0${secs}`, W / 2, l.z - 22, { color: '#ff5a8a', align: 'center', size: 8 });
      }
    }
    for (const s of this.strikes) {
      if (s.t < s.delay) {
        const k = s.t / s.delay;
        ctx.strokeStyle = s.kind === 'emp' ? '#c08aff' : '#ffffff';
        ctx.globalAlpha = 0.4 + 0.5 * (Math.floor(s.t / 3) % 2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(Math.round(s.x - camX), Math.round(s.z), 18, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = s.kind === 'emp' ? 'rgba(160,100,255,0.3)' : 'rgba(255,255,200,0.3)';
        ctx.beginPath();
        ctx.ellipse(Math.round(s.x - camX), Math.round(s.z), 18 * k, 6 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const s of this.shocks) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.max(0, 1 - s.r / 240);
      ctx.beginPath();
      ctx.ellipse(Math.round(s.x - camX), Math.round(s.z), s.r, s.r / 2.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.fx.drawUnder(ctx, camX);
    // shadows
    const all: Ent[] = [this.player, ...this.enemies, ...this.objs];
    ctx.fillStyle = 'rgba(10,8,20,0.32)';
    for (const e of all) {
      if (!e.shadow || (e instanceof Prop && e.carried)) continue;
      if (e === this.player && (this.player.state === 'fallHole' && this.player.t > 20)) continue;
      const sw = e.shadow * Math.max(0.5, 1 - e.y / 120);
      ctx.beginPath();
      ctx.ellipse(Math.round(e.x - camX), Math.round(e.z), sw, Math.max(2, sw * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // manholes under everything
    for (const o of this.objs) if (o instanceof Prop && o.kind === 'manhole') o.draw(ctx, camX);
    all.sort((a, b) => a.z - b.z || (a === this.player ? 1 : -1));
    for (const e of all) {
      if (e instanceof Prop && e.kind === 'manhole') continue;
      if (e instanceof Prop && e.carried) continue;
      e.draw(ctx, camX, this);
    }
    // carried prop over head
    if (this.player.carrying) this.player.carrying.draw(ctx, camX, this);
    // lasers beams
    for (const l of this.lasers) {
      if (l.t >= l.warn && l.t < l.warn + l.dur) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,40,100,0.6)';
        ctx.fillRect(0, Math.round(l.z - 70), W, 72);
        ctx.fillStyle = 'rgba(255,220,240,0.9)';
        ctx.fillRect(0, Math.round(l.z - 40), W, 10);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    for (const s of this.sweeps) {
      const sx = Math.round(s.x - camX);
      if (s.t < 50) {
        if (Math.floor(s.t / 4) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,40,90,0.5)';
          ctx.fillRect(s.dir > 0 ? 0 : W - 8, Z_MIN - 10, 8, Z_MAX - Z_MIN + 20);
        }
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,40,90,0.55)';
        ctx.fillRect(sx - 5, 0, 10, Z_MAX + 6);
        ctx.fillStyle = 'rgba(255,230,240,0.9)';
        ctx.fillRect(sx - 1, 0, 3, Z_MAX + 6);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // lightning strikes bolts
    for (const s of this.strikes) {
      if (s.t >= s.delay && s.t < s.delay + 8) {
        const sx = Math.round(s.x - camX);
        ctx.fillStyle = s.kind === 'emp' ? '#d0b0ff' : '#ffffff';
        let x = sx;
        for (let y = 0; y < s.z; y += 8) {
          const nx = sx + rand(-6, 6);
          ctx.fillRect(Math.min(x, nx), y, Math.abs(nx - x) + 2, 9);
          x = nx;
        }
      }
    }
    // road traffic in front
    for (const c of this.cars) drawSprite(ctx, [PROPS.carWhite, PROPS.carRed, PROPS.carTaxi][c.spr], c.x - camX, c.y, c.vx < 0);
    if (this.sprinkler) this.drawSprinkler(ctx, camX);
    this.fx.drawOver(ctx, camX);
    ctx.restore();
    // weather
    if (this.stage.rain) {
      ctx.strokeStyle = 'rgba(160,190,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.rainDrops) {
        ctx.moveTo(Math.round(d.x), Math.round(d.y));
        ctx.lineTo(Math.round(d.x - 2), Math.round(d.y + d.l));
      }
      ctx.stroke();
      if (this.bd.theme.tint) {
        ctx.fillStyle = this.bd.theme.tint;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.lightning > 0 && this.lightning % 4 < 2) {
        ctx.fillStyle = 'rgba(220,230,255,0.35)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    // super cinematic overlay
    if (this.superT > 0) this.drawSuper(ctx);
    if (this.slowT > 0) {
      ctx.fillStyle = 'rgba(80,200,255,0.08)';
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flashT > 0) {
      ctx.globalAlpha = Math.min(0.85, this.flashT / 8);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  private drawSprinkler(ctx: CanvasRenderingContext2D, camX: number) {
    const s = this.sprinkler!;
    const x = Math.round(s.x - camX);
    const y = 262;
    ctx.fillStyle = '#140c18';
    ctx.fillRect(x - 2, y - 30, 84, 26);
    ctx.fillStyle = '#2a8a4a';
    ctx.fillRect(x, y - 28, 22, 22);
    ctx.fillStyle = '#9ad0ff';
    ctx.fillRect(x + 3, y - 25, 14, 8);
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(x + 22, y - 26, 58, 18);
    ctx.fillStyle = '#c8c8c0';
    ctx.fillRect(x + 22, y - 12, 58, 4);
    drawText(ctx, '洒水作业', x + 51, y - 25, { size: 8, color: '#2a8a4a', outline: null, align: 'center' });
    ctx.fillStyle = '#16161c';
    for (const wx of [x + 10, x + 40, x + 68]) {
      ctx.beginPath();
      ctx.arc(wx, y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.t > 90) {
      ctx.fillStyle = 'rgba(160,220,255,0.6)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 10 - i * 5 + rand(-2, 2), CURB_Y - 8 - i * 3 + rand(-2, 2), 4, 3);
    }
    if (s.t % 30 < 15) drawText(ctx, '♪', x + 30, y - 46, { color: '#ffffff' });
  }

  private drawSuper(ctx: CanvasRenderingContext2D) {
    const t = this.superT;
    const p = this.superBy!;
    if (t < 36) {
      ctx.fillStyle = `rgba(0,0,20,${Math.min(0.6, t / 30)})`;
      ctx.fillRect(0, 0, W, H);
      // speed lines converging
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 20; i++) {
        const y = (i * 37 + t * 13) % H;
        const l = 40 + ((i * 53) % 80);
        ctx.fillRect(i % 2 ? 0 : W - l, y, l, 1);
      }
      // redraw player on top of the darkness
      p.draw(ctx, Math.round(this.camX), this);
      drawText(ctx, '人行道正义拳!!', W / 2, 60, { color: '#ffe040', outline: '#6a1a00', align: 'center', scale: 3, thickOutline: true });
      drawText(ctx, '— 让大家都慢下来 —', W / 2, 104, { color: '#ffffff', align: 'center' });
    } else {
      // giant blue fist sweeping the screen
      const k = (t - 36) / 34;
      const fx = -100 + k * (W + 200);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(60,170,255,0.5)';
      ctx.fillRect(0, 120, W, 110);
      ctx.fillStyle = 'rgba(160,230,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(fx, 175, 90, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(fx + 20, 175, 50, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawVoidFx(ctx: CanvasRenderingContext2D) {
    // drifting order numbers in the void
    const t = this.frames;
    for (let i = 0; i < 10; i++) {
      const x = (i * 97 + t * (0.3 + (i % 3) * 0.2)) % (W + 60) - 30;
      const y = 20 + ((i * 41) % 100);
      drawText(ctx, ['#', '¥', '!', '★'][i % 4] + ((i * 7919 + Math.floor(t / 30)) % 9999), x, y, { size: 8, color: i % 2 ? '#5a2a9a' : '#9a2a5a', outline: null });
    }
  }
}
