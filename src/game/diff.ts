import { save } from '../core/save';

export interface DiffParams {
  dmgTaken: number;
  enemySpeed: number;
  enemyHp: number;
  credits: number; // -1 = infinite
  lives: number;
  maxActive: number; // extra concurrent riders
  aggression: number; // 0..1 how often riders aim at player
  regen: number; // meter regen per frame
}

const TABLE: DiffParams[] = [
  { dmgTaken: 0.55, enemySpeed: 0.85, enemyHp: 0.8, credits: -1, lives: 5, maxActive: -1, aggression: 0.45, regen: 0.12 },
  { dmgTaken: 1.0, enemySpeed: 1.0, enemyHp: 1.0, credits: 5, lives: 3, maxActive: 0, aggression: 0.65, regen: 0.06 },
  { dmgTaken: 1.4, enemySpeed: 1.12, enemyHp: 1.2, credits: 3, lives: 3, maxActive: 1, aggression: 0.8, regen: 0.04 },
  { dmgTaken: 2.0, enemySpeed: 1.25, enemyHp: 1.45, credits: 1, lives: 2, maxActive: 2, aggression: 0.95, regen: 0.02 },
];

export function diff(): DiffParams {
  return TABLE[save.settings.difficulty] || TABLE[1];
}
