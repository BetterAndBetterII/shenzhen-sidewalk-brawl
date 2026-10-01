// localStorage persistence: settings, high score, unlocked stages, best ranks.
export type Difficulty = 0 | 1 | 2 | 3;
export const DIFF_NAMES = ['简单', '普通', '困难', '地狱'];
export const DIFF_DESC = ['续币无限 · 敌人更慢', '街机原味 · 5 枚硬币', '3 枚硬币 · 骑手更凶', '1 枚硬币 · 算法全开'];

export interface SaveData {
  v: 1;
  highScore: number;
  unlocked: number; // highest stage index unlocked (0-based)
  ranks: Record<number, string>;
  bestScores: Record<number, number>;
  cleared: boolean;
  settings: {
    difficulty: Difficulty;
    crt: boolean;
    muted: boolean;
    music: number;
    sfx: number;
    shake: boolean;
    touch: 'auto' | 'on' | 'off';
  };
}

const KEY = 'szsb-save-v1';

function defaults(): SaveData {
  return {
    v: 1,
    highScore: 20000,
    unlocked: 0,
    ranks: {},
    bestScores: {},
    cleared: false,
    settings: { difficulty: 1, crt: true, muted: false, music: 0.6, sfx: 0.85, shake: true, touch: 'auto' },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    const def = defaults();
    return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) } };
  } catch {
    return defaults();
  }
}

export const save: SaveData = loadSave();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore quota / private mode */
  }
}

const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];
export function recordStage(idx: number, rank: string, score: number) {
  const prev = save.ranks[idx];
  if (!prev || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(prev)) save.ranks[idx] = rank;
  save.bestScores[idx] = Math.max(save.bestScores[idx] || 0, score);
  persist();
}
