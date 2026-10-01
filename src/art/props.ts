// Props, items, projectiles and FX sprites.
import { col, PixelBuf, Sprite, makeSprite, shadeHex } from '../core/gfx';
import { drawHumanoid, OUTLINE, Style } from './humanoid';
import { HERO_STYLE } from './hero';

const O = () => col(OUTLINE);
function fin(buf: PixelBuf, ox: number, oy: number, outline = true): Sprite {
  if (outline) buf.outline(O());
  return makeSprite(buf, ox, oy);
}

export const PROPS: Record<string, Sprite> = {};
export const ITEMS: Record<string, Sprite> = {};
export const FX: Record<string, Sprite[]> = {};

function crate(broken = false): Sprite {
  const b = new PixelBuf(26, 26);
  const c = col('#b47a40');
  const d = col('#7a4a20');
  const l = col('#d8a060');
  if (!broken) {
    b.rect(2, 4, 22, 20, d);
    b.rect(3, 5, 20, 18, c);
    b.rect(3, 5, 20, 2, l);
    for (let y = 9; y < 23; y += 5) b.rect(3, y, 20, 1, d);
    b.line(3, 5, 22, 22, d);
    b.rect(3, 5, 2, 18, d);
    b.rect(21, 5, 2, 18, d);
  } else {
    b.poly([[3, 24], [12, 24], [10, 16], [4, 18]], c);
    b.poly([[14, 24], [23, 24], [22, 14], [16, 18]], c);
  }
  return fin(b, 13, 24);
}

function cone(): Sprite {
  const b = new PixelBuf(16, 22);
  b.rect(2, 18, 12, 3, col('#d84a1a'));
  b.poly([[5, 18], [11, 18], [9, 3], [7, 3]], col('#ff6a1a'));
  b.rect(5, 8, 6, 2, col('#f8f8f8'));
  b.rect(4, 13, 8, 2, col('#f8f8f8'));
  b.set(7, 4, col('#ffa060'));
  return fin(b, 8, 21);
}

function sharedBike(color: string, lying = false): Sprite {
  const b = new PixelBuf(40, 30);
  const c = col(color);
  const wheel = (x: number, y: number) => {
    b.circle(x, y, 6, col('#1a1a22'));
    b.circle(x, y, 4, col('#c0c4cc'));
    b.circle(x, y, 2, col('#3a3c46'));
  };
  if (!lying) {
    wheel(9, 22);
    wheel(30, 22);
    b.thick(9, 22, 18, 22, 0.6, c);
    b.thick(9, 22, 15, 12, 0.7, c);
    b.thick(15, 12, 27, 12, 0.7, c);
    b.thick(18, 22, 15, 12, 0.7, c);
    b.thick(18, 22, 27, 12, 0.7, c);
    b.thick(27, 12, 30, 22, 0.7, c);
    b.rect(12, 9, 7, 2, col('#202024'));
    b.thick(27, 12, 26, 6, 0.5, col('#9aa0aa'));
    b.rect(23, 5, 7, 2, col('#202024'));
    b.rect(29, 8, 7, 5, col('#c0c4cc'));
    b.rect(16, 17, 4, 4, col('#2a2a2a'));
  } else {
    wheel(10, 22);
    wheel(28, 20);
    b.thick(10, 22, 28, 20, 0.8, c);
    b.thick(14, 18, 26, 17, 0.8, c);
  }
  return fin(b, 20, 28);
}

function trashBin(): Sprite {
  const b = new PixelBuf(18, 24);
  b.rect(2, 4, 14, 19, col('#2a8a4a'));
  b.rect(2, 4, 14, 2, col('#4aaa6a'));
  b.rect(1, 2, 16, 3, col('#1e6a38'));
  b.rect(4, 8, 2, 12, col('#3a9a5a'));
  b.rect(7, 10, 5, 5, col('#e8e8e8'));
  return fin(b, 9, 23);
}

function manhole(open: boolean): Sprite {
  const b = new PixelBuf(30, 12);
  if (open) {
    b.ellipse(15, 6, 13, 5, col('#0a0a0e'));
    b.ellipse(15, 5, 11, 3, col('#000000'));
    b.rect(3, 5, 1, 2, col('#5a5a62'));
  } else {
    b.ellipse(15, 6, 13, 5, col('#4a4a52'));
    b.ellipse(15, 6, 11, 4, col('#62626a'));
    for (let x = 6; x < 26; x += 3) b.rect(x, 5, 1, 2, col('#3a3a42'));
  }
  return makeSprite(b, 15, 6);
}

function warnSign(): Sprite {
  const b = new PixelBuf(16, 24);
  b.rect(7, 10, 2, 13, col('#5a5a62'));
  b.poly([[8, 1], [15, 13], [1, 13]], col('#ffcc1a'));
  b.rect(7, 5, 2, 4, col('#1a1a1a'));
  b.rect(7, 10, 2, 1, col('#1a1a1a'));
  return fin(b, 8, 23);
}

function parkedCar(color: string): Sprite {
  const b = new PixelBuf(110, 40);
  const c = col(color);
  const d = col(shadeHex(color, -0.25));
  b.poly([[4, 30], [6, 20], [24, 17], [38, 6], [72, 5], [88, 16], [104, 19], [106, 30]], c);
  b.rect(4, 26, 102, 6, d);
  b.poly([[40, 8], [70, 7], [82, 16], [34, 17]], col('#2a3a52'));
  b.poly([[42, 9], [54, 9], [50, 15], [38, 15]], col('#5a7aa2'));
  b.rect(56, 7, 2, 10, c);
  b.rect(98, 21, 6, 3, col('#fff6c0'));
  b.rect(5, 21, 4, 3, col('#ff3a3a'));
  for (const x of [24, 86]) {
    b.circle(x, 31, 7, col('#16161c'));
    b.circle(x, 31, 4, col('#a8acb4'));
    b.circle(x, 31, 2, col('#4a4a52'));
  }
  b.line(20, 18, 100, 20, col(shadeHex(color, 0.3)));
  return fin(b, 55, 38);
}

function food(kind: string): Sprite {
  const b = new PixelBuf(16, 16);
  switch (kind) {
    case 'sausage': // 烤肠
      b.line(3, 14, 12, 3, col('#c8a070'));
      b.thick(5, 11, 11, 4, 2, col('#c8402a'));
      b.line(6, 9, 10, 5, col('#f07050'));
      break;
    case 'corn': // 热玉米
      b.thick(5, 12, 11, 4, 3, col('#f0c830'));
      for (let i = 0; i < 6; i++) b.set(6 + i, 11 - i * 1.3, col('#c89a10'));
      b.poly([[3, 14], [6, 9], [8, 13]], col('#6ac03a'));
      break;
    case 'noodle': // 肠粉
      b.ellipse(8, 11, 7, 3, col('#f0f0f0'));
      b.ellipse(8, 9, 5, 2, col('#fff8e8'));
      b.rect(5, 8, 2, 1, col('#c87a3a'));
      b.rect(9, 9, 3, 1, col('#6ac03a'));
      break;
    case 'tea': // 奶茶
      b.poly([[4, 4], [12, 4], [11, 15], [5, 15]], col('#e8d0b0'));
      b.rect(4, 3, 9, 2, col('#ffffff'));
      b.line(9, 0, 8, 4, col('#ff5a8a'));
      for (let i = 0; i < 4; i++) b.set(6 + i * 1.3, 13, col('#3a2a20'));
      b.rect(5, 8, 6, 2, col('#3a96ff'));
      break;
    case 'redpacket': // 红包
      b.rect(3, 2, 10, 13, col('#e02a2a'));
      b.poly([[3, 2], [13, 2], [8, 7]], col('#ff4a3a'));
      b.circle(8, 7, 2, col('#ffd030'));
      break;
    case 'battery': // 满电 1UP
      b.rect(3, 3, 10, 12, col('#2a2a32'));
      b.rect(6, 1, 4, 2, col('#2a2a32'));
      b.rect(4, 4, 8, 10, col('#3ad05a'));
      b.poly([[9, 5], [6, 10], [8, 10], [7, 13], [10, 8], [8, 8]], col('#ffffff'));
      break;
  }
  return fin(b, 8, 15);
}

function projectile(kind: string): Sprite {
  const b = new PixelBuf(18, 18);
  switch (kind) {
    case 'parcel':
      b.rect(3, 4, 12, 10, col('#8a6034'));
      b.rect(4, 5, 10, 8, col('#c89a5a'));
      b.rect(4, 5, 10, 1, col('#e0b878'));
      b.rect(9, 5, 1, 8, col('#e8d8a8'));
      break;
    case 'cabbage':
      b.circle(9, 9, 6, col('#4ab03a'));
      b.circle(8, 8, 4, col('#8ad86a'));
      b.line(9, 4, 9, 14, col('#c8f0a0'));
      break;
    case 'ticket': // 罚单
      b.rect(3, 4, 12, 9, col('#f8f8f0'));
      b.rect(3, 4, 12, 2, col('#e02a2a'));
      b.rect(5, 8, 8, 1, col('#5a5a5a'));
      b.rect(5, 10, 6, 1, col('#5a5a5a'));
      break;
    case 'phonecase':
      b.rect(5, 2, 8, 14, col('#ff5a9a'));
      b.rect(6, 3, 6, 12, col('#ff8ab8'));
      b.circle(8, 5, 1, col('#202028'));
      break;
    case 'pin': // map marker
      b.circle(9, 6, 5, col('#ff2a4a'));
      b.poly([[5, 8], [13, 8], [9, 16]], col('#ff2a4a'));
      b.circle(9, 6, 2, col('#ffffff'));
      break;
    case 'helmet':
      b.circle(9, 9, 6, col('#4a4a4a'));
      b.circle(8, 8, 4, col('#6a6a6a'));
      b.rect(10, 8, 5, 3, col('#2a3248'));
      break;
    case 'drone':
      b.rect(4, 8, 10, 3, col('#2a2a32'));
      b.rect(1, 6, 6, 1, col('#9aa0aa'));
      b.rect(11, 6, 6, 1, col('#9aa0aa'));
      b.rect(3, 7, 1, 2, col('#5a5a62'));
      b.rect(14, 7, 1, 2, col('#5a5a62'));
      b.set(9, 11, col('#ff3a3a'));
      break;
  }
  return fin(b, 9, 9);
}

function stars(frame: number): Sprite {
  const b = new PixelBuf(24, 10);
  for (let i = 0; i < 3; i++) {
    const a = frame * 0.6 + (i * Math.PI * 2) / 3;
    const x = 12 + Math.cos(a) * 9;
    const y = 5 + Math.sin(a) * 3;
    const c = col(i % 2 ? '#ffe040' : '#ffffff');
    b.set(x, y, c);
    b.set(x - 1, y, c);
    b.set(x + 1, y, c);
    b.set(x, y - 1, c);
    b.set(x, y + 1, c);
  }
  return makeSprite(b, 12, 5);
}

function spark(frame: number, color: string, core: string): Sprite {
  const n = 24;
  const b = new PixelBuf(n, n);
  const c = n / 2;
  const r = [4, 8, 10, 9][frame];
  const cc = col(color);
  const k = col(core);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (frame % 2) * 0.4;
    const rr = i % 2 ? r * 0.55 : r;
    const inner = frame >= 2 ? rr * 0.6 : 0;
    b.line(c + Math.cos(a) * inner, c + Math.sin(a) * inner, c + Math.cos(a) * rr, c + Math.sin(a) * rr, cc);
  }
  if (frame < 2) b.circle(c, c, 3 - frame, k);
  return makeSprite(b, c, c);
}

export function portrait(style: Style, size = 22): HTMLCanvasElement {
  const big = new PixelBuf(80, 90);
  const st = { ...style, scale: 1.9 };
  drawHumanoid(big, 40, 88, { lean: 0, armF: [10, 5], armB: [-10, -5], legF: [5, 0], legB: [-5, 0], tail: 1.3 }, st);
  big.outline(O());
  const cv = big.toCanvas();
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#2a2040';
  ctx.fillRect(0, 0, size, size);
  // head center is approx at (40 + small, 88 - 23*1.9 - 15*1.9 - 6*1.9)
  const hy = 88 - 1.9 * (23 + 15 + 6.2);
  ctx.drawImage(cv, Math.round(40 - size / 2 + 1), Math.round(hy - size / 2 + 3), size, size, 0, 0, size, size);
  return out;
}

export let HERO_PORTRAIT: HTMLCanvasElement;

export function buildProps() {
  PROPS.crate = crate();
  PROPS.crateBroken = crate(true);
  PROPS.cone = cone();
  PROPS.bikeY = sharedBike('#f0c020');
  PROPS.bikeB = sharedBike('#3a8af0');
  PROPS.bikeG = sharedBike('#30c060');
  PROPS.bikeLying = sharedBike('#3a8af0', true);
  PROPS.bin = trashBin();
  PROPS.manholeOpen = manhole(true);
  PROPS.manhole = manhole(false);
  PROPS.warn = warnSign();
  PROPS.carWhite = parkedCar('#f0f0f4');
  PROPS.carRed = parkedCar('#d83a3a');
  PROPS.carTaxi = parkedCar('#2a6ad8');
  for (const k of ['sausage', 'corn', 'noodle', 'tea', 'redpacket', 'battery']) ITEMS[k] = food(k);
  for (const k of ['parcel', 'cabbage', 'ticket', 'phonecase', 'pin', 'helmet', 'drone']) PROPS[k] = projectile(k);
  FX.stars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) => stars(f));
  FX.spark = [0, 1, 2, 3].map((f) => spark(f, '#ffe860', '#ffffff'));
  FX.sparkBlue = [0, 1, 2, 3].map((f) => spark(f, '#6ad8ff', '#ffffff'));
  FX.sparkRed = [0, 1, 2, 3].map((f) => spark(f, '#ff5a3a', '#fff0a0'));
  HERO_PORTRAIT = portrait(HERO_STYLE, 22);
}
