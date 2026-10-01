// Procedural stage backgrounds: sky, far skyline, facade+ground chunks.
import { ditherGradient, newCanvas, rng, shadeHex, W } from '../core/gfx';
import { drawText } from '../core/text';

export const GROUND_TOP = 146; // where sidewalk starts (screen y)
export const Z_MIN = 152;
export const Z_MAX = 234;
export const CURB_Y = 238;
export const CHUNK = 256;

export interface Theme {
  id: string;
  sky: string[];
  far: { color: string; lit: string; litChance: number; tall: number; style: 'cv' | 'cbd' | 'hqb' | 'tech' | 'void' };
  modules: string[];
  names: string[];
  night: boolean;
  rain?: boolean;
  ground: { stone: string; stone2: string; gap: string; tactile: boolean };
  road: string;
  tileColors: string[];
  seed: number;
  tint?: string; // overlay
}

type Ctx = CanvasRenderingContext2D;
let R: () => number = Math.random;
const ri = (a: number, b: number) => Math.floor(a + R() * (b - a + 1));
const pk = <T,>(a: T[]) => a[Math.floor(R() * a.length)];

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function circ(c: Ctx, cx: number, cy: number, r: number, color: string) {
  c.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string) {
  c.fillStyle = color;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}
/** sagging cable */
function cable(c: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, color: string) {
  c.fillStyle = color;
  const n = Math.abs(x1 - x0) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    c.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y), 1, 1);
  }
}

// ---------- small reusable bits ----------
function acUnit(c: Ctx, x: number, y: number) {
  rect(c, x, y, 12, 8, '#d8d8d0');
  rect(c, x, y + 7, 12, 1, '#9a9a92');
  circ(c, x + 4, y + 4, 2, '#8a8a84');
  rect(c, x + 8, y + 2, 3, 1, '#9a9a92');
  rect(c, x + 8, y + 4, 3, 1, '#9a9a92');
  rect(c, x + 1, y + 8, 1, 2, '#6a6a64');
  rect(c, x + 10, y + 8, 1, 2, '#6a6a64');
}
function cctv(c: Ctx, x: number, y: number, flip = false) {
  const d = flip ? -1 : 1;
  rect(c, x, y, 2, 4, '#5a5a62');
  rect(c, x + (flip ? -7 : 1), y - 2, 8, 4, '#e8e8f0');
  rect(c, x + (flip ? -7 : 1), y + 1, 8, 1, '#a0a0aa');
  rect(c, x + (flip ? -8 : 8), y - 1, 1, 2, '#202028');
  rect(c, x + d * 6, y - 1, 1, 1, '#ff3a3a');
}
function laundry(c: Ctx, x: number, y: number, w: number) {
  line(c, x, y, x + w, y, '#8a8a8a');
  let i = x + 2;
  while (i < x + w - 4) {
    const cw = ri(3, 6);
    const ch = ri(5, 9);
    rect(c, i, y + 1, cw, ch, pk(['#e04848', '#3a7ad8', '#f0e070', '#f0f0f0', '#6ac86a', '#e080c0', '#303040']));
    i += cw + ri(1, 3);
  }
}
function lantern(c: Ctx, x: number, y: number) {
  line(c, x + 2, y - 3, x + 2, y, '#5a3a20');
  rect(c, x, y, 5, 6, '#e02a2a');
  rect(c, x + 1, y - 1, 3, 1, '#c8a030');
  rect(c, x + 1, y + 6, 3, 1, '#c8a030');
  rect(c, x + 1, y + 1, 1, 4, '#ff6a5a');
  line(c, x + 2, y + 7, x + 2, y + 9, '#f0c040');
}
function window_(c: Ctx, x: number, y: number, w: number, h: number, night: boolean, bars: boolean, lit: boolean) {
  rect(c, x - 1, y - 1, w + 2, h + 2, '#5a5a60');
  rect(c, x, y, w, h, lit ? pk(['#ffe7a0', '#ffd27a', '#c8e8ff']) : night ? '#1a2034' : pk(['#4a6a8a', '#5a7a9a', '#3a5070']));
  if (!lit) rect(c, x, y, Math.ceil(w / 3), h, night ? '#222a40' : '#6a8aaa');
  rect(c, x + Math.floor(w / 2), y, 1, h, '#5a5a60');
  if (bars) {
    rect(c, x - 2, y + h + 1, w + 4, 1, '#7a7a80');
    for (let i = x - 2; i <= x + w + 2; i += 2) rect(c, i, y - 2, 1, h + 4, '#6a6a70');
    rect(c, x - 2, y - 2, w + 5, 1, '#6a6a70');
  }
}
function signBoard(c: Ctx, x: number, y: number, w: number, h: number, text: string, bg: string, fg: string, night: boolean) {
  rect(c, x, y, w, h, shadeHex(bg, -0.35));
  rect(c, x + 1, y + 1, w - 2, h - 2, bg);
  rect(c, x + 1, y + 1, w - 2, 1, shadeHex(bg, 0.3));
  const size = h >= 14 ? 12 : 8;
  drawText(c, text, x + w / 2, y + Math.floor((h - size) / 2), {
    size: size as 12 | 8,
    color: fg,
    outline: night ? shadeHex(fg, -0.6) : shadeHex(bg, -0.55),
    align: 'center',
  });
}
function verticalNeon(c: Ctx, x: number, y: number, text: string, color: string) {
  const n = [...text].length;
  rect(c, x - 1, y - 1, 16, n * 13 + 4, '#14141c');
  rect(c, x, y, 14, n * 13 + 2, '#20202a');
  [...text].forEach((ch, i) => drawText(c, ch, x + 7, y + 2 + i * 13, { color, outline: shadeHex(color, -0.6), align: 'center' }));
}
function awning(c: Ctx, x: number, y: number, w: number, c1: string, c2: string) {
  for (let i = 0; i < w; i += 6) {
    const cc = (i / 6) % 2 ? c2 : c1;
    c.fillStyle = cc;
    c.beginPath();
    c.moveTo(x + i, y);
    c.lineTo(x + i + 6, y);
    c.lineTo(x + i + 7, y + 10);
    c.lineTo(x + i - 1, y + 10);
    c.closePath();
    c.fill();
    // scalloped edge
    circ(c, x + i + 3, y + 10, 2, cc);
  }
  rect(c, x - 1, y - 1, w + 2, 2, shadeHex(c1, -0.4));
}
function crate(c: Ctx, x: number, y: number, w: number, h: number, color = '#b07a40') {
  rect(c, x, y, w, h, shadeHex(color, -0.35));
  rect(c, x + 1, y + 1, w - 2, h - 2, color);
  for (let i = y + 3; i < y + h - 1; i += 3) rect(c, x + 1, i, w - 2, 1, shadeHex(color, -0.15));
}
function parcel(c: Ctx, x: number, y: number, w: number, h: number) {
  rect(c, x, y, w, h, '#8a6034');
  rect(c, x + 1, y + 1, w - 2, h - 2, '#c89a5a');
  rect(c, x + 1, y + 1, w - 2, 1, '#e0b878');
  rect(c, x + Math.floor(w / 2), y + 1, 1, h - 2, '#e8d8a8');
}
function fruitPile(c: Ctx, x: number, y: number, w: number) {
  crate(c, x, y + 4, w, 7, '#8a5a30');
  const cols = ['#e83a2a', '#ff9a1a', '#f8d040', '#6ac03a', '#a02a6a'];
  const fc = pk(cols);
  for (let i = 0; i < w - 2; i += 3) circ(c, x + 2 + i, y + 3 - ((i / 3) % 2), 1, fc);
  rect(c, x + 1, y + 1, 1, 1, '#ffffff');
}
function person(c: Ctx, x: number, y: number, shirt: string, squat = false) {
  // tiny background person (shopkeeper / customer)
  const skin = '#d89a6a';
  if (squat) {
    circ(c, x + 3, y - 15, 3, skin);
    rect(c, x, y - 18, 6, 2, '#201818');
    rect(c, x, y - 12, 7, 6, shirt);
    rect(c, x - 1, y - 6, 9, 4, '#3a3a4a');
    rect(c, x - 1, y - 2, 3, 2, '#202020');
    rect(c, x + 6, y - 2, 3, 2, '#202020');
    return;
  }
  circ(c, x + 3, y - 22, 3, skin);
  rect(c, x, y - 25, 6, 2, '#201818');
  rect(c, x, y - 18, 7, 9, shirt);
  rect(c, x - 1, y - 17, 1, 7, skin);
  rect(c, x + 7, y - 17, 1, 7, skin);
  rect(c, x + 1, y - 9, 2, 8, '#2a2a3a');
  rect(c, x + 4, y - 9, 2, 8, '#2a2a3a');
}

// ---------- building upper floors ----------
function upperFloors(c: Ctx, x: number, w: number, top: number, bottom: number, th: Theme) {
  const tile = pk(th.tileColors);
  rect(c, x, top, w, bottom - top, tile);
  // tile texture
  for (let yy = top + 2; yy < bottom; yy += 4) for (let xx = x + ((yy / 4) % 2) * 2; xx < x + w; xx += 6) rect(c, xx, yy, 1, 1, shadeHex(tile, -0.07));
  rect(c, x, top, 2, bottom - top, shadeHex(tile, -0.2));
  rect(c, x + w - 2, top, 2, bottom - top, shadeHex(tile, -0.25));
  // roof edge
  rect(c, x - 1, top, w + 2, 3, shadeHex(tile, -0.3));
  if (R() < 0.5) {
    // water tank / antenna on roof
    rect(c, x + ri(4, Math.max(5, w - 16)), top - 8, 10, 8, '#8a9aa8');
    line(c, x + w - 6, top, x + w - 6, top - 12, '#5a5a62');
  }
  const floorH = 22;
  const cols = Math.max(1, Math.floor((w - 6) / 18));
  const gap = (w - cols * 12) / (cols + 1);
  for (let fy = top + 6; fy + 16 < bottom; fy += floorH) {
    for (let i = 0; i < cols; i++) {
      const wx = x + gap + i * (12 + gap);
      const lit = th.night ? R() < 0.45 : false;
      window_(c, wx, fy, 12, 12, th.night, th.id === 'cv' || th.id === 'rain' ? R() < 0.7 : false, lit);
      if (R() < 0.35) acUnit(c, wx + ri(-2, 2), fy + 14);
      if ((th.id === 'cv' || th.id === 'rain') && R() < 0.25) laundry(c, wx - 3, fy + 13, 18);
    }
  }
}

// ---------- ground-floor modules ----------
type ModFn = (c: Ctx, x: number, w: number, th: Theme, name: string) => void;

function shopBase(c: Ctx, x: number, w: number, th: Theme, name: string, signBg: string, signFg: string) {
  // sign band
  signBoard(c, x + 2, 96, w - 4, 16, name, signBg, signFg, th.night);
  // opening
  rect(c, x + 2, 112, w - 4, 34, th.night ? '#2a2430' : '#3a3438');
  rect(c, x + 3, 113, w - 6, 33, th.night ? '#ffd88a' : '#c8b8a0');
  rect(c, x + 3, 113, w - 6, 4, th.night ? '#ffeab8' : '#e8d8c0');
  // shelves
  for (let yy = 120; yy < 140; yy += 8) {
    rect(c, x + 4, yy, w - 8, 1, '#6a5040');
    for (let xx = x + 5; xx < x + w - 6; xx += 3) rect(c, xx, yy - 3, 2, 3, pk(['#e04848', '#3a7ad8', '#f0c040', '#f0f0f0', '#40a060', '#a060c0']));
  }
  // rolling shutter top
  rect(c, x + 2, 112, w - 4, 2, '#8a8a90');
  // pillar
  rect(c, x, 96, 2, 50, '#7a7076');
  rect(c, x + w - 2, 96, 2, 50, '#5a5056');
}

const SIGN_COLORS: [string, string][] = [
  ['#d82a2a', '#ffe060'],
  ['#1a5ac8', '#ffffff'],
  ['#f0c020', '#c01a1a'],
  ['#2a9a4a', '#ffffff'],
  ['#ffffff', '#d82a2a'],
  ['#1a1a2a', '#40e0ff'],
  ['#e85a1a', '#ffffff'],
];

const MODULES: Record<string, ModFn> = {
  shop(c, x, w, th, name) {
    const [bg, fg] = pk(SIGN_COLORS);
    shopBase(c, x, w, th, name, bg, fg);
    if (R() < 0.6) person(c, x + ri(8, w - 14), 146, pk(['#d84a4a', '#4a6ad8', '#f0f0f0', '#e8a030']));
    if (R() < 0.5) crate(c, x + 4, 136, 12, 10);
  },
  fruit(c, x, w, th) {
    shopBase(c, x, w, th, '鲜果', '#ffffff', '#d82a2a');
    awning(c, x - 2, 108, w + 4, '#e02a2a', '#f4f4f4');
    for (let i = x + 4; i < x + w - 14; i += 14) fruitPile(c, i, 132, 12);
    person(c, x + w - 16, 140, '#e03030');
  },
  corn(c, x, w, th) {
    shopBase(c, x, w, th, pk(['粥粉面', '早餐', '肠粉王']), '#f0c020', '#c01a1a');
    // cart
    rect(c, x + 6, 126, 26, 16, '#c8c8c0');
    rect(c, x + 6, 126, 26, 2, '#e8e8e0');
    signBoard(c, x + 8, 129, 22, 11, '热玉米', '#fff6d0', '#d01a1a', th.night);
    circ(c, x + 19, 122, 6, '#7a7a80');
    rect(c, x + 13, 122, 13, 4, '#9a9aa0');
    for (let i = 0; i < 3; i++) rect(c, x + 14 + i * 4, 116, 2, 6, '#f8e070');
    rect(c, x + 8, 142, 3, 4, '#3a3a40');
    rect(c, x + 28, 142, 3, 4, '#3a3a40');
  },
  netcafe(c, x, w, th) {
    rect(c, x + 2, 96, w - 4, 50, '#1a1a24');
    signBoard(c, x + 4, 98, w - 8, 14, '24H网吧', '#14141c', '#ff3a5a', true);
    for (let i = x + 6; i < x + w - 8; i += 9) {
      rect(c, i, 122, 7, 6, '#40c0ff');
      rect(c, i + 1, 123, 5, 4, '#a0f0ff');
      rect(c, i + 2, 128, 3, 2, '#3a3a44');
    }
    rect(c, x + 2, 132, w - 4, 2, '#3a3a44');
    rect(c, x, 96, 2, 50, '#3a3a40');
  },
  express(c, x, w, th) {
    shopBase(c, x, w, th, '快递代收', '#1a3a7a', '#ffffff');
    for (let yy = 116; yy < 140; yy += 8) for (let xx = x + 5; xx < x + w - 10; xx += 9) parcel(c, xx, yy, 8, 7);
    parcel(c, x + 4, 136, 12, 10);
    parcel(c, x + 14, 138, 10, 8);
    parcel(c, x + 6, 129, 9, 7);
  },
  repair(c, x, w, th) {
    shopBase(c, x, w, th, pk(['手机维修', '贴膜', '维修', '开锁配匙']), '#1a1a2a', '#ffe040');
    rect(c, x + 6, 130, w - 12, 10, '#9aa0aa');
    rect(c, x + 6, 130, w - 12, 1, '#d0d8e0');
    for (let xx = x + 8; xx < x + w - 10; xx += 6) rect(c, xx, 132, 4, 6, '#2a2a3a');
  },
  alley(c, x, w, th) {
    // gap between buildings — shows deep alley
    rect(c, x, 40, w, 106, th.night ? '#0c0c14' : '#4a4650');
    rect(c, x + 2, 50, w - 4, 96, th.night ? '#121220' : '#5e5a64');
    for (let i = 0; i < 6; i++) cable(c, x - 4, 50 + i * 9, x + w + 4, 52 + i * 8, ri(3, 8), '#1a1a20');
    rect(c, x + 3, 128, 8, 18, '#2a6a3a');
    rect(c, x + 3, 128, 8, 2, '#3a8a4a');
    if (th.night) lantern(c, x + w / 2 - 2, 60);
  },
  metro(c, x, w, th) {
    rect(c, x, 70, w, 76, '#d8dce4');
    rect(c, x, 70, w, 4, '#a0a8b8');
    signBoard(c, x + 8, 76, w - 16, 16, '地铁 龙华站', '#1a5a3a', '#ffffff', th.night);
    circ(c, x + 14, 84, 6, '#e8e8e8');
    drawText(c, 'M', x + 14, 79, { color: '#1a5a3a', outline: null, align: 'center' });
    // escalator mouth
    rect(c, x + 10, 98, w - 20, 48, '#2a2a34');
    for (let i = 0; i < 8; i++) rect(c, x + 12 + i * 2, 104 + i * 5, w - 24 - i * 4, 2, '#5a5a66');
    rect(c, x + 8, 98, 2, 48, '#9aa0aa');
    rect(c, x + w - 10, 98, 2, 48, '#9aa0aa');
    for (let i = 0; i < 4; i++) person(c, x + 14 + i * ((w - 28) / 4), 120 + i * 6, pk(['#4a4a5a', '#ffffff', '#3a5a9a', '#9a3a3a']));
  },
  bikes(c, x, w) {
    // pile of shared bikes
    for (let i = 0; i < w - 10; i += 7) {
      const bc = pk(['#f0c020', '#3a8af0', '#30c060', '#f05a2a']);
      const yy = 136 - (i % 14 === 0 ? 4 : 0);
      circ(c, x + i + 3, yy + 6, 3, '#202024');
      circ(c, x + i + 12, yy + 6, 3, '#202024');
      line(c, x + i + 3, yy + 6, x + i + 8, yy, bc);
      line(c, x + i + 8, yy, x + i + 12, yy + 6, bc);
      line(c, x + i + 5, yy - 1, x + i + 11, yy - 1, bc);
    }
  },
  banner(c, x, w, th, name) {
    rect(c, x, 98, w, 48, '#2a6ab0');
    rect(c, x, 98, w, 2, '#5a9ae0');
    rect(c, x, 144, w, 2, '#1a3a70');
    drawText(c, name, x + w / 2, 112, { color: '#ffffff', outline: '#1a3a70', align: 'center' });
    for (let i = x + 4; i < x + w; i += 30) rect(c, i, 98, 1, 48, '#3a7ac0');
  },
  hedge(c, x, w) {
    rect(c, x, 128, w, 18, '#2a7a3a');
    for (let i = x; i < x + w; i += 4) circ(c, i + 2, 128, 3, R() < 0.5 ? '#3a9a4a' : '#2e8a40');
    for (let i = 0; i < w / 10; i++) circ(c, x + ri(2, w - 2), ri(126, 134), 1, pk(['#ff6aa0', '#ffe040', '#ff4040']));
    rect(c, x, 142, w, 4, '#9a9a90');
  },
  tree(c, x, w) {
    // banyan
    rect(c, x + w / 2 - 3, 70, 7, 76, '#6a4a30');
    rect(c, x + w / 2 - 3, 70, 2, 76, '#8a6a48');
    for (let i = 0; i < 18; i++) circ(c, x + w / 2 + ri(-22, 22), ri(30, 70), ri(6, 11), pk(['#2a7a34', '#3a9a44', '#22662c']));
    for (let i = 0; i < 6; i++) line(c, x + w / 2 + ri(-16, 16), 60, x + w / 2 + ri(-18, 18), 100 + ri(0, 20), '#5a4028');
  },
  busstop(c, x, w, th) {
    rect(c, x + 2, 96, w - 4, 4, '#4a5a6a');
    signBoard(c, x + 4, 100, 44, 12, '公交站', '#1a5ac8', '#ffffff', th.night);
    rect(c, x + 4, 112, 2, 34, '#9aa0aa');
    rect(c, x + w - 6, 112, 2, 34, '#9aa0aa');
    rect(c, x + w - 30, 104, 24, 38, '#e8f0f8');
    drawText(c, '为奋斗者', x + w - 18, 112, { size: 8, color: '#d82a2a', outline: null, align: 'center' });
    drawText(c, '点赞', x + w - 18, 122, { size: 8, color: '#d82a2a', outline: null, align: 'center' });
    rect(c, x + 8, 134, w - 40, 3, '#7a7a80');
    person(c, x + 14, 146, '#3a5a9a');
  },
  hqb(c, x, w, th, name) {
    rect(c, x, 60, w, 86, '#2a2a38');
    // LED screen
    rect(c, x + 4, 64, w - 8, 28, '#0a0a14');
    const scr = pk(['#ff3a8a', '#3af0ff', '#ffe03a', '#7aff5a']);
    drawText(c, pk(['手机配件', '全场批发', '无人机', '二手回收', '耳机特价']), x + w / 2, 72, { color: scr, outline: '#0a0a14', align: 'center' });
    for (let i = x + 5; i < x + w - 5; i += 2) rect(c, i, 64, 1, 28, 'rgba(0,0,0,0.25)');
    signBoard(c, x + 2, 96, w - 4, 15, name, '#1a1a2a', pk(['#40e0ff', '#ff4a8a', '#ffe040']), true);
    rect(c, x + 2, 111, w - 4, 35, '#e8eef4');
    for (let yy = 116; yy < 144; yy += 7)
      for (let xx = x + 5; xx < x + w - 6; xx += 5) rect(c, xx, yy, 3, 5, pk(['#20202a', '#3a3a50', '#e0e0e0', '#ff5a8a', '#5ab0ff']));
    rect(c, x + 2, 138, w - 4, 8, '#9aa8b8');
    person(c, x + ri(6, w - 12), 146, pk(['#2a2a2a', '#ffffff', '#4a6ad8']));
  },
  lobby(c, x, w, th, name) {
    rect(c, x, 80, w, 66, '#3a4a5a');
    for (let xx = x + 2; xx < x + w - 2; xx += 12) {
      rect(c, xx, 84, 11, 62, th.night ? '#ffe8b0' : '#7ab0d8');
      rect(c, xx, 84, 4, 62, th.night ? '#fff0c8' : '#a8d0f0');
    }
    signBoard(c, x + 6, 86, w - 12, 14, name, '#1a2a3a', '#e0f0ff', th.night);
    for (let i = 0; i < 3; i++) person(c, x + 10 + i * 16, 146, pk(['#ffffff', '#2a3a5a', '#e0e0e0']));
  },
  lockers(c, x, w, th) {
    rect(c, x + 2, 104, w - 4, 42, '#e0e4ea');
    signBoard(c, x + 4, 98, w - 8, 12, '外卖柜', '#2a8a5a', '#ffffff', th.night);
    for (let yy = 112; yy < 144; yy += 8)
      for (let xx = x + 5; xx < x + w - 8; xx += 9) {
        rect(c, xx, yy, 8, 7, '#b8c0ca');
        rect(c, xx + 6, yy + 3, 1, 1, R() < 0.5 ? '#3ad05a' : '#ff3a3a');
      }
    for (let i = 0; i < 3; i++) parcel(c, x + 6 + i * 8, 140, 7, 6);
  },
  server(c, x, w) {
    // final stage: server racks with blinking LEDs
    rect(c, x, 40, w, 106, '#120a20');
    for (let xx = x + 3; xx < x + w - 10; xx += 16) {
      rect(c, xx, 50, 14, 96, '#22183a');
      for (let yy = 54; yy < 144; yy += 5) {
        rect(c, xx + 1, yy, 12, 4, '#2e2250');
        rect(c, xx + 2, yy + 1, 1, 1, pk(['#3aff7a', '#ff3a6a', '#3ad0ff', '#2e2250']));
        rect(c, xx + 4, yy + 1, 1, 1, pk(['#3aff7a', '#2e2250']));
      }
    }
  },
  screens(c, x, w, th, name) {
    rect(c, x, 40, w, 106, '#0e0818');
    for (let yy = 48; yy < 140; yy += 24)
      for (let xx = x + 3; xx < x + w - 20; xx += 26) {
        rect(c, xx, yy, 22, 18, '#3a2a5a');
        rect(c, xx + 1, yy + 1, 20, 16, '#100a20');
        const t = pk(['00:12', '超时', '#2847', '差评', '5.0★', '-¥2', '派单', '加速']);
        drawText(c, t, xx + 11, yy + 4, { size: 8, color: pk(['#ff3a6a', '#3affb0', '#ffe03a', '#c08aff']), outline: null, align: 'center' });
      }
    drawText(c, name, x + w / 2, 30, { size: 8, color: '#ff3a6a', outline: null, align: 'center' });
  },
};

// ---------- stage themes ----------
export const THEMES: Record<string, Theme> = {
  cv: {
    id: 'cv',
    sky: ['#6ab8ec', '#90cdf2', '#c4e6f8', '#e8f6fc'],
    far: { color: '#8aa0b8', lit: '#c8d8e8', litChance: 0, tall: 70, style: 'cv' },
    modules: ['shop', 'fruit', 'corn', 'netcafe', 'express', 'repair', 'alley', 'shop', 'bikes'],
    names: ['沙县小吃', '猪脚饭', '五金店', '理发', '便利店', '潮汕牛肉粉', '麻辣烫', '大药房', '烧腊', '凉茶'],
    night: false,
    ground: { stone: '#8c8c90', stone2: '#7a7a80', gap: '#5a5a62', tactile: true },
    road: '#3a3a42',
    tileColors: ['#d8ccb8', '#c8c0b0', '#e0d0c0', '#b8b4ac', '#d0b8a8'],
    seed: 11,
  },
  metro: {
    id: 'metro',
    sky: ['#f08a6a', '#f8b080', '#fcd8a8', '#fff0d0'],
    far: { color: '#b08a90', lit: '#ffd8a0', litChance: 0.2, tall: 90, style: 'cbd' },
    modules: ['shop', 'corn', 'metro', 'bikes', 'shop', 'repair', 'express', 'bikes', 'metro'],
    names: ['包子铺', '豆浆油条', '肠粉王', '便利店', '早餐', '煎饼果子', '咖啡'],
    night: false,
    ground: { stone: '#9a9494', stone2: '#8a8484', gap: '#6a6466', tactile: true },
    road: '#44404a',
    tileColors: ['#e8d8c8', '#d8c8c0', '#f0e0d0'],
    seed: 22,
  },
  avenue: {
    id: 'avenue',
    sky: ['#2a7ad8', '#4a9ae8', '#7ab8f0', '#b8dcfa'],
    far: { color: '#5a7aa0', lit: '#a8d0f0', litChance: 0.1, tall: 120, style: 'cbd' },
    modules: ['tree', 'hedge', 'banner', 'busstop', 'tree', 'hedge', 'banner'],
    names: ['来了就是深圳人', '深圳速度', '文明出行 礼让行人', '时间就是金钱', '人行道请慢行'],
    night: false,
    ground: { stone: '#b0a8a0', stone2: '#a09890', gap: '#7a726c', tactile: true },
    road: '#3a3a44',
    tileColors: ['#c8d0d8'],
    seed: 33,
  },
  hqb: {
    id: 'hqb',
    sky: ['#d88a50', '#e8a868', '#f0c890', '#f8e0b8'],
    far: { color: '#7a6a7a', lit: '#ffe0a0', litChance: 0.25, tall: 110, style: 'hqb' },
    modules: ['hqb', 'hqb', 'repair', 'hqb', 'alley', 'hqb', 'express'],
    names: ['赛博电子城', '数码广场', '华强二手机', '电子市场', '配件批发', '无人机专卖'],
    night: false,
    ground: { stone: '#9a9090', stone2: '#8a8282', gap: '#625a5c', tactile: true },
    road: '#3e3a42',
    tileColors: ['#c8b8b0', '#b8b0b8'],
    seed: 44,
  },
  rain: {
    id: 'rain',
    sky: ['#06070f', '#0c1022', '#141a36', '#1e2448'],
    far: { color: '#1a1e36', lit: '#ffd060', litChance: 0.35, tall: 90, style: 'cv' },
    modules: ['shop', 'netcafe', 'alley', 'shop', 'corn', 'netcafe', 'repair', 'shop'],
    names: ['烧烤', '宵夜', '糖水铺', '砂锅粥', '牛杂', '夜猫便利', '烤生蚝'],
    night: true,
    rain: true,
    ground: { stone: '#3a3a4a', stone2: '#323242', gap: '#22222e', tactile: true },
    road: '#1a1a24',
    tileColors: ['#4a4658', '#3e3a4c', '#524a5a'],
    seed: 55,
    tint: 'rgba(20,30,80,0.18)',
  },
  tech: {
    id: 'tech',
    sky: ['#2a2a6a', '#7a4a8a', '#d06a7a', '#f8a868'],
    far: { color: '#3a3a6a', lit: '#ffe8a0', litChance: 0.5, tall: 140, style: 'tech' },
    modules: ['lobby', 'lockers', 'shop', 'lobby', 'hedge', 'lockers', 'lobby'],
    names: ['某某科技', '996咖啡', '轻食沙拉', '大厂A座', '创新中心', '加班健身房', '云端大厦'],
    night: false,
    ground: { stone: '#a8a8b0', stone2: '#9898a2', gap: '#70707a', tactile: true },
    road: '#3a3a48',
    tileColors: ['#7a8aa8'],
    seed: 66,
  },
  void: {
    id: 'void',
    sky: ['#040008', '#0e0220', '#1c0638', '#2a0a4e'],
    far: { color: '#1a0a30', lit: '#ff3a6a', litChance: 0.3, tall: 130, style: 'void' },
    modules: ['server', 'screens', 'server', 'screens'],
    names: ['派单中心', '调度核心', '算法机房', 'ALGO-9000'],
    night: true,
    ground: { stone: '#2a1a40', stone2: '#22143a', gap: '#5a2a9a', tactile: false },
    road: '#120a20',
    tileColors: ['#2a1a40'],
    seed: 77,
  },
};

// ---------- pre-rendered layers ----------
export function renderSky(th: Theme): HTMLCanvasElement {
  const [cv, c] = newCanvas(W, 160);
  ditherGradient(c, 0, 0, W, 160, th.sky);
  R = rng(th.seed * 7);
  if (!th.night) {
    // clouds
    for (let i = 0; i < 7; i++) {
      const x = ri(0, W);
      const y = ri(8, 60);
      for (let k = 0; k < 5; k++) circ(c, x + k * 7, y - (k % 2) * 3, ri(4, 7), 'rgba(255,255,255,0.55)');
    }
  } else {
    for (let i = 0; i < 40; i++) rect(c, ri(0, W), ri(0, 70), 1, 1, th.id === 'void' ? '#a04aff' : '#8a90c0');
  }
  if (th.id === 'metro') circ(c, 380, 70, 16, '#fff2c0');
  if (th.id === 'tech') circ(c, 110, 100, 18, '#ffd08a');
  return cv;
}

export function renderFar(th: Theme): HTMLCanvasElement {
  const w = 1024;
  const [cv, c] = newCanvas(w, 160);
  R = rng(th.seed * 13);
  const f = th.far;
  let x = 0;
  while (x < w) {
    const bw = ri(18, 46);
    const bh = ri(Math.floor(f.tall * 0.4), f.tall);
    const top = 150 - bh;
    const color = shadeHex(f.color, R() * 0.12 - 0.06);
    rect(c, x, top, bw, bh + 10, color);
    if (f.style === 'cbd' || f.style === 'tech') {
      // glass stripes
      for (let yy = top + 3; yy < 150; yy += 4) rect(c, x + 2, yy, bw - 4, 1, shadeHex(color, 0.12));
      if (R() < 0.3) {
        // spire
        rect(c, x + bw / 2 - 1, top - 14, 2, 14, color);
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x + bw / 2, top - 8);
        c.lineTo(x + bw, top);
        c.fill();
      }
    } else if (f.style === 'void') {
      for (let yy = top + 3; yy < 150; yy += 5) for (let xx = x + 2; xx < x + bw - 2; xx += 4) if (R() < 0.3) rect(c, xx, yy, 2, 1, R() < 0.5 ? '#ff3a6a' : '#5a2aff');
    } else {
      for (let yy = top + 4; yy < 150; yy += 6)
        for (let xx = x + 2; xx < x + bw - 3; xx += 5) {
          if (R() < f.litChance) rect(c, xx, yy, 2, 2, f.lit);
          else rect(c, xx, yy, 2, 2, shadeHex(color, -0.12));
        }
    }
    if (f.style === 'hqb' && R() < 0.4) {
      rect(c, x + 2, top + 6, bw - 4, 8, pk(['#ff3a8a', '#3af0ff', '#ffe03a']));
    }
    x += bw + ri(-4, 4);
  }
  // signature landmark per theme
  if (th.id === 'avenue' || th.id === 'tech') {
    // parody supertall tower
    const tx = 600;
    rect(c, tx, 10, 30, 150, shadeHex(f.color, -0.12));
    for (let yy = 14; yy < 150; yy += 4) rect(c, tx + 3, yy, 24, 1, shadeHex(f.color, 0.1));
    rect(c, tx + 13, 0, 4, 12, shadeHex(f.color, -0.12));
  }
  return cv;
}

/** Facade + sidewalk + curb + road for one chunk. */
export function renderChunk(th: Theme, index: number, plan: ChunkPlan[]): HTMLCanvasElement {
  const [cv, c] = newCanvas(CHUNK, 270);
  const x0 = index * CHUNK;
  // draw any module intersecting the chunk
  for (const m of plan) {
    if (m.x + m.w < x0 - 40 || m.x > x0 + CHUNK + 40) continue;
    c.save();
    c.translate(-x0, 0);
    R = rng(th.seed * 1000 + m.i * 31);
    if (m.upper) upperFloors(c, m.x, m.w, m.top, 96, th);
    const fn = MODULES[m.kind] || MODULES.shop;
    fn(c, m.x, m.w, th, m.name);
    // decorations
    if (m.cctv) cctv(c, m.x + m.w - 6, m.top + 12, true);
    if (m.neon) verticalNeon(c, m.x + m.w - 16, m.top + 20, m.neon, th.night ? '#ff4a7a' : '#3affb0');
    if (m.lantern) lantern(c, m.x + 6, 90);
    c.restore();
  }
  // cables crossing
  R = rng(th.seed * 77 + index);
  if (th.id === 'cv' || th.id === 'rain' || th.id === 'hqb') {
    for (let i = 0; i < 3; i++) cable(c, -2, ri(30, 90), CHUNK + 2, ri(30, 90), ri(4, 14), '#16161c');
  }
  // sidewalk
  drawGround(c, th, x0);
  return cv;
}

function drawGround(c: Ctx, th: Theme, x0: number) {
  const g = th.ground;
  // storefront step
  rect(c, 0, GROUND_TOP, CHUNK, 4, shadeHex(g.stone, -0.25));
  rect(c, 0, GROUND_TOP, CHUNK, 1, shadeHex(g.stone, 0.15));
  rect(c, 0, GROUND_TOP + 4, CHUNK, CURB_Y - GROUND_TOP - 4, g.gap);
  R = rng(th.seed * 5 + Math.floor(x0 / CHUNK));
  if (th.id === 'void') {
    rect(c, 0, GROUND_TOP + 4, CHUNK, CURB_Y - GROUND_TOP - 4, '#0e0620');
    for (let y = GROUND_TOP + 6; y < CURB_Y; y += 8) rect(c, 0, y, CHUNK, 1, '#3a1a6a');
    for (let x = -(x0 % 16); x < CHUNK; x += 16) rect(c, x, GROUND_TOP + 4, 1, CURB_Y - GROUND_TOP - 4, '#3a1a6a');
  } else {
    // cobblestone rows
    let row = 0;
    for (let y = GROUND_TOP + 5; y < CURB_Y - 1; y += 7) {
      const off = (row % 2) * 6 - (x0 % 12);
      for (let x = off - 12; x < CHUNK; x += 12) {
        const sc = R() < 0.5 ? g.stone : g.stone2;
        const v = shadeHex(sc, R() * 0.1 - 0.05);
        rect(c, x + 1, y, 10, 6, v);
        rect(c, x + 1, y, 10, 1, shadeHex(v, 0.12));
        rect(c, x + 1, y + 5, 10, 1, shadeHex(v, -0.12));
        if (R() < 0.04) rect(c, x + 3 + ri(0, 4), y + 2, 2, 1, shadeHex(v, -0.3)); // crack / gum
      }
      row++;
    }
    // tactile paving
    if (g.tactile) {
      const ty = 214;
      rect(c, 0, ty, CHUNK, 9, '#c8a020');
      rect(c, 0, ty, CHUNK, 1, '#e8c840');
      for (let x = -(x0 % 4); x < CHUNK; x += 4) {
        rect(c, x + 1, ty + 2, 2, 1, '#a88010');
        rect(c, x + 1, ty + 5, 2, 1, '#a88010');
      }
    }
    // litter & stains
    for (let i = 0; i < 6; i++) {
      const lx = ri(0, CHUNK);
      const ly = ri(GROUND_TOP + 8, CURB_Y - 4);
      const k = R();
      if (k < 0.3) rect(c, lx, ly, 3, 2, pk(['#e83a2a', '#f0f0f0', '#3a7ad8', '#f0c020']));
      else if (k < 0.5) {
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(lx, ly, ri(5, 10), 3);
      }
    }
    if (th.rain) {
      // puddles with neon reflections
      for (let i = 0; i < 3; i++) {
        const px = ri(0, CHUNK - 30);
        const py = ri(GROUND_TOP + 14, CURB_Y - 10);
        c.fillStyle = 'rgba(30,40,90,0.55)';
        c.fillRect(px, py, ri(18, 34), 4);
        c.fillRect(px + 3, py - 1, ri(10, 20), 6);
        c.fillStyle = pk(['rgba(255,60,120,0.5)', 'rgba(60,220,255,0.45)', 'rgba(255,220,80,0.4)']);
        c.fillRect(px + 5, py + 1, 6, 2);
      }
    }
  }
  // curb
  rect(c, 0, CURB_Y, CHUNK, 5, th.id === 'void' ? '#5a2a9a' : '#b8b8b0');
  rect(c, 0, CURB_Y, CHUNK, 1, th.id === 'void' ? '#ff3a6a' : '#e0e0d8');
  rect(c, 0, CURB_Y + 4, CHUNK, 1, '#5a5a58');
  if (th.id !== 'void') for (let x = -(x0 % 24); x < CHUNK; x += 24) rect(c, x, CURB_Y + 1, 1, 3, '#8a8a84');
  // road
  rect(c, 0, CURB_Y + 5, CHUNK, 270 - CURB_Y - 5, th.road);
  for (let x = -(x0 % 40); x < CHUNK; x += 40) rect(c, x, 262, 20, 2, th.id === 'void' ? '#ff3a6a' : '#e8e8e0');
  for (let i = 0; i < 30; i++) rect(c, ri(0, CHUNK), ri(CURB_Y + 6, 269), 1, 1, shadeHex(th.road, 0.1));
}

export interface ChunkPlan {
  i: number;
  x: number;
  w: number;
  kind: string;
  name: string;
  top: number;
  upper: boolean;
  cctv: boolean;
  neon: string;
  lantern: boolean;
}

export function planFacade(th: Theme, length: number): ChunkPlan[] {
  R = rng(th.seed);
  const plan: ChunkPlan[] = [];
  let x = -40;
  let i = 0;
  while (x < length + 600) {
    const kind = th.modules[i % th.modules.length];
    const w =
      kind === 'alley' ? ri(18, 28) : kind === 'tree' ? 56 : kind === 'hedge' ? ri(40, 70) : kind === 'banner' ? ri(110, 150) : kind === 'metro' ? 96 : kind === 'bikes' ? ri(40, 60) : ri(56, 84);
    const upper = !['alley', 'tree', 'hedge', 'banner', 'busstop', 'metro', 'bikes', 'server', 'screens', 'hqb', 'lobby'].includes(kind);
    plan.push({
      i,
      x,
      w,
      kind,
      name: pk(th.names),
      top: upper ? ri(-10, 30) : 0,
      upper,
      cctv: upper && R() < 0.6,
      neon: upper && R() < 0.25 ? pk(['住宿', '网吧', '旅馆', '按揭', '招工']) : '',
      lantern: (th.id === 'cv' || th.id === 'rain') && R() < 0.3,
    });
    x += w;
    i++;
  }
  // shuffle-ish: rotate the module order a bit per theme
  return plan;
}

export interface Backdrop {
  theme: Theme;
  sky: HTMLCanvasElement;
  far: HTMLCanvasElement;
  chunks: Map<number, HTMLCanvasElement>;
  plan: ChunkPlan[];
}

export function makeBackdrop(themeId: string, length: number): Backdrop {
  const theme = THEMES[themeId];
  return { theme, sky: renderSky(theme), far: renderFar(theme), chunks: new Map(), plan: planFacade(theme, length) };
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, b: Backdrop, camX: number) {
  ctx.drawImage(b.sky, 0, 0);
  const fx = Math.floor(camX * 0.25) % b.far.width;
  ctx.drawImage(b.far, -fx, 0);
  ctx.drawImage(b.far, -fx + b.far.width, 0);
  const first = Math.floor(camX / CHUNK);
  for (let i = first; i <= first + Math.ceil(W / CHUNK) + 1; i++) {
    if (i < -1) continue;
    let ch = b.chunks.get(i);
    if (!ch) {
      ch = renderChunk(b.theme, i, b.plan);
      b.chunks.set(i, ch);
    }
    ctx.drawImage(ch, Math.round(i * CHUNK - camX), 0);
  }
}
