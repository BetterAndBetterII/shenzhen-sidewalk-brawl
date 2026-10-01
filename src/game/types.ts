// Shared entity base & combat types.
import type { World } from './world';

export interface Attack {
  id: number;
  dmg: number;
  kb: number; // knockback speed
  launch?: boolean; // knockdown / launch
  stun?: number; // stun build-up
  hitstop?: number;
  zr: number; // depth tolerance
  box: [number, number, number, number]; // forward x0,x1, height y0,y1
  kind: 'punch' | 'kick' | 'special' | 'super' | 'throw' | 'proj' | 'ram' | 'hazard';
  spark?: 'spark' | 'sparkBlue' | 'sparkRed';
  sfx?: string;
  unblockable?: boolean;
  dir?: number;
  counter?: boolean;
  fromBehindOnly?: boolean;
  air?: boolean;
}

let atkId = 1;
export function newAttackId() {
  return atkId++;
}

export abstract class Ent {
  x = 0;
  z = 0;
  y = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  face = 1;
  dead = false;
  remove = false;
  hp = 1;
  maxHp = 1;
  hw = 9; // hurt half-width
  hh = 44; // hurt height
  flash = 0;
  shadow = 11;
  hitIds = new Set<number>();
  name = '';
  portrait: HTMLCanvasElement | null = null;
  isBoss = false;
  abstract update(w: World): void;
  abstract draw(ctx: CanvasRenderingContext2D, camX: number, w: World): void;
  canBeHit(): boolean {
    return !this.dead;
  }
  /** returns true if the hit connected */
  hurt(w: World, a: Attack, from: { x: number; z: number; face: number }): boolean {
    return false;
  }
}

export function overlap(ax: number, aface: number, a: Attack, ay: number, az: number, t: Ent): boolean {
  if (Math.abs(az - t.z) > a.zr) return false;
  const x0 = ax + aface * a.box[0];
  const x1 = ax + aface * a.box[1];
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  if (hi < t.x - t.hw || lo > t.x + t.hw) return false;
  const y0 = ay + a.box[2];
  const y1 = ay + a.box[3];
  if (y1 < t.y || y0 > t.y + t.hh) return false;
  return true;
}
