// Delivery riders, their e-scooters and other vehicles. All parody brands.
import { col, PixelBuf, Painter, ScaledPainter, Sprite, makeSprite, shadeHex } from '../core/gfx';
import { textCanvas } from '../core/text';
import { drawHumanoid, ik, OUTLINE, Pose, Style } from './humanoid';

export interface Brand {
  id: string;
  name: string; // platform name
  glyph: string; // box text
  body: string; // scooter body color
  box: string;
  boxText: string;
  jacket: string;
  helmet: string;
  visor?: string;
  pants?: string;
}

export const BRANDS: Record<string, Brand> = {
  meican: { id: 'meican', name: '美餐', glyph: '美', body: '#ffc61a', box: '#ffd21f', boxText: '#2a1a00', jacket: '#ffc61a', helmet: '#ffd21f' },
  elema: { id: 'elema', name: '饿了吗', glyph: '饿', body: '#2f86f0', box: '#3a96ff', boxText: '#ffffff', jacket: '#2f86f0', helmet: '#3a96ff' },
  lvye: { id: 'lvye', name: '绿叶鲜生', glyph: '鲜', body: '#3cc853', box: '#46d65e', boxText: '#ffffff', jacket: '#33b84a', helmet: '#46d65e' },
  shan: { id: 'shan', name: '闪送侠', glyph: '闪', body: '#ff4a2a', box: '#ff5a32', boxText: '#ffec40', jacket: '#26262e', helmet: '#ff4a2a' },
  shunfeng: { id: 'shunfeng', name: '顺疯快递', glyph: '顺疯', body: '#2a2a30', box: '#33333a', boxText: '#ffcf2a', jacket: '#2a2a30', helmet: '#e8e8e8' },
  algo: { id: 'algo', name: '算法傀儡', glyph: '单', body: '#7a3cff', box: '#8a4cff', boxText: '#ff3a6a', jacket: '#5a2ad0', helmet: '#3a2a60', visor: '#ff2244' },
  boss1: { id: 'boss1', name: '单王', glyph: '王', body: '#ffb800', box: '#ffd21f', boxText: '#c01a1a', jacket: '#ffc61a', helmet: '#ffd700', visor: '#1a1a2a' },
  moto: { id: 'moto', name: '摩的', glyph: '', body: '#c82a2a', box: '#c82a2a', boxText: '#fff', jacket: '#6a5a4a', helmet: '#4a4a4a' },
  wind: { id: 'wind', name: '闪送侠', glyph: '闪', body: '#ff3a1a', box: '#ff5a32', boxText: '#ffec40', jacket: '#1a1a22', helmet: '#ff3a1a', visor: '#ffb020', pants: '#1a1a22' },
  mod: { id: 'mod', name: '魔改', glyph: '改', body: '#8a3aff', box: '#1a1a2a', boxText: '#3af0ff', jacket: '#2a2a3a', helmet: '#3af0ff', visor: '#ff3a8a' },
  station: { id: 'station', name: '站长', glyph: '站', body: '#e8e8f0', box: '#2a5ad0', boxText: '#ffffff', jacket: '#2a5ad0', helmet: '#e8e8e8' },
  rain: { id: 'rain', name: '雨夜骑手', glyph: '饿', body: '#2f86f0', box: '#3a96ff', boxText: '#ffffff', jacket: '#2a6ad0', helmet: '#3a96ff' },
};

export type VehicleKind = 'scooter' | 'sport' | 'trike' | 'moto' | 'bike';

export interface RiderSprite extends Sprite {
  w: number;
}

export function riderStyle(b: Brand): Style {
  return {
    skin: '#d89a6a',
    top: b.jacket,
    pants: b.pants || '#2a2c38',
    shoes: '#2a2224',
    head: 'helmet',
    helmet: b.helmet,
    visor: b.visor || '#2a3248',
    sleeves: true,
    bulk: 0.95,
    gloves: b.id === 'algo' ? '#222' : undefined,
    vest: b.id === 'shan' ? '#ff5a32' : undefined,
  };
}

function wheel(buf: Painter, x: number, y: number, r: number, frame: number, rim = '#9aa0aa') {
  buf.circle(x, y, r, col('#1a1a22'));
  buf.circle(x, y, r - 1.6, col('#3a3c46'));
  buf.circle(x, y, r - 2.6, col(rim));
  buf.circle(x, y, Math.max(0.8, r - 4), col('#5a5e68'));
  const a = (frame * Math.PI) / 3;
  for (let k = 0; k < 3; k++) {
    const aa = a + (k * Math.PI * 2) / 3;
    buf.set(x + Math.cos(aa) * (r - 2.2), y + Math.sin(aa) * (r - 2.2), col('#2a2c34'));
  }
}

interface Anchor {
  seat: [number, number];
  bar: [number, number];
  foot: [number, number];
  box?: [number, number, number, number];
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** Draw vehicle (facing right) — returns anchors. layer 'back' draws stuff behind rider. */
function drawVehicle(buf: Painter, kind: VehicleKind, b: Brand, ox: number, oy: number, frame: number, layer: 'back' | 'front'): Anchor {
  const body = col(b.body);
  const bodyD = col(shadeHex(b.body, -0.3));
  const bodyL = col(shadeHex(b.body, 0.35));
  const dark = col('#24242c');
  const grey = col('#80848e');
  const X = (x: number) => ox + x;
  const Y = (y: number) => oy + y;
  if (kind === 'scooter') {
    if (layer === 'back') {
      wheel(buf, X(-14), Y(-5), 5, frame);
      // rear body
      buf.poly([[X(-20), Y(-9)], [X(-5), Y(-9)], [X(-5), Y(-15)], [X(-9), Y(-18)], [X(-19), Y(-18)], [X(-22), Y(-13)]], body);
      buf.rect(X(-20), Y(-11), 15, 2, bodyD);
      buf.rect(X(-18), Y(-17), 8, 1, bodyL);
      buf.rect(X(-18), Y(-20), 12, 3, dark); // seat
      buf.rect(X(-24), Y(-15), 2, 2, col('#ff3030')); // tail light
      // rack + box
      buf.rect(X(-24), Y(-21), 12, 1, grey);
      buf.rect(X(-26), Y(-37), 16, 16, col(shadeHex(b.box, -0.28)));
      buf.rect(X(-26), Y(-37), 15, 15, col(b.box));
      buf.rect(X(-26), Y(-37), 15, 2, col(shadeHex(b.box, 0.3)));
      buf.rect(X(-26), Y(-24), 15, 1, col(shadeHex(b.box, -0.15)));
      // floor board
      buf.rect(X(-7), Y(-9), 15, 3, dark);
    } else {
      // front column + fairing
      buf.poly([[X(7), Y(-7)], [X(13), Y(-7)], [X(17), Y(-14)], [X(14), Y(-25)], [X(10), Y(-25)], [X(9), Y(-14)]], body);
      buf.line(X(14), Y(-24), X(16), Y(-14), bodyL);
      buf.rect(X(15), Y(-21), 3, 3, col('#fff6c0')); // headlight
      buf.rect(X(9), Y(-27), 7, 2, dark); // handlebar
      buf.rect(X(9), Y(-29), 1, 2, grey); // mirror stalk
      buf.rect(X(8), Y(-31), 3, 2, grey);
      wheel(buf, X(15), Y(-5), 5, frame + 1);
      buf.poly([[X(10), Y(-11)], [X(20), Y(-11)], [X(19), Y(-8)], [X(11), Y(-8)]], bodyD); // mudguard
    }
    return { seat: [-11, -19], bar: [10, -27], foot: [1, -9], box: [-26, -37, 15, 15], w: 48, h: 46, ox, oy };
  }
  if (kind === 'sport') {
    if (layer === 'back') {
      wheel(buf, X(-16), Y(-6), 6, frame, '#c0c4cc');
      buf.poly([[X(-22), Y(-14)], [X(-6), Y(-10)], [X(8), Y(-12)], [X(12), Y(-20)], [X(-2), Y(-20)], [X(-12), Y(-19)]], body);
      buf.line(X(-20), Y(-15), X(8), Y(-15), bodyL);
      buf.rect(X(-14), Y(-21), 12, 2, dark);
      buf.rect(X(-23), Y(-16), 2, 2, col('#ff3030'));
      // small backpack box
      buf.rect(X(-23), Y(-36), 14, 14, col(shadeHex(b.box, -0.28)));
      buf.rect(X(-23), Y(-36), 13, 13, col(b.box));
      buf.rect(X(-23), Y(-36), 13, 1, col(shadeHex(b.box, 0.3)));
    } else {
      buf.poly([[X(8), Y(-10)], [X(14), Y(-10)], [X(19), Y(-22)], [X(14), Y(-26)], [X(10), Y(-22)]], body);
      buf.poly([[X(12), Y(-22)], [X(21), Y(-19)], [X(18), Y(-27)]], bodyD);
      buf.rect(X(18), Y(-21), 3, 2, col('#fff6c0'));
      buf.rect(X(11), Y(-27), 6, 2, dark);
      wheel(buf, X(17), Y(-6), 6, frame + 1, '#c0c4cc');
    }
    return { seat: [-8, -20], bar: [12, -26], foot: [2, -11], box: [-23, -36, 13, 13], w: 50, h: 44, ox, oy };
  }
  if (kind === 'trike') {
    if (layer === 'back') {
      wheel(buf, X(-26), Y(-5), 5, frame);
      wheel(buf, X(-12), Y(-5), 5, frame + 2);
      buf.rect(X(-34), Y(-12), 30, 3, dark);
      // cargo box (big)
      buf.rect(X(-35), Y(-44), 30, 33, col(shadeHex(b.box, -0.25)));
      buf.rect(X(-35), Y(-44), 29, 32, col(b.box));
      buf.rect(X(-35), Y(-44), 29, 2, col(shadeHex(b.box, 0.25)));
      buf.rect(X(-33), Y(-28), 25, 1, col(shadeHex(b.box, -0.4)));
      // stacked parcels on roof
      buf.rect(X(-32), Y(-51), 10, 7, col('#c89a5a'));
      buf.rect(X(-32), Y(-51), 10, 1, col('#e0b878'));
      buf.rect(X(-21), Y(-49), 8, 5, col('#b8884a'));
      buf.line(X(-27), Y(-51), X(-27), Y(-45), col('#e8d8a8'));
      buf.rect(X(-4), Y(-18), 8, 3, dark); // seat
    } else {
      buf.poly([[X(6), Y(-8)], [X(12), Y(-8)], [X(16), Y(-16)], [X(13), Y(-26)], [X(9), Y(-26)], [X(7), Y(-16)]], body);
      buf.rect(X(14), Y(-21), 3, 3, col('#fff6c0'));
      buf.rect(X(8), Y(-28), 7, 2, dark);
      buf.rect(X(-2), Y(-11), 10, 3, dark);
      wheel(buf, X(14), Y(-5), 5, frame + 1);
    }
    return { seat: [0, -17], bar: [10, -28], foot: [5, -10], box: [-35, -44, 29, 32], w: 64, h: 56, ox, oy };
  }
  if (kind === 'moto') {
    if (layer === 'back') {
      wheel(buf, X(-17), Y(-6), 6, frame);
      buf.poly([[X(-24), Y(-12)], [X(-4), Y(-10)], [X(6), Y(-14)], [X(4), Y(-21)], [X(-8), Y(-22)], [X(-22), Y(-18)]], body);
      buf.rect(X(-20), Y(-23), 18, 3, dark);
      buf.rect(X(-8), Y(-12), 10, 4, col('#5a5e68')); // engine
      buf.line(X(-22), Y(-8), X(-4), Y(-8), col('#c0c4cc')); // exhaust
      // sunshade canopy poles
      buf.line(X(-22), Y(-23), X(-22), Y(-56), grey);
      buf.line(X(8), Y(-28), X(10), Y(-56), grey);
    } else {
      buf.poly([[X(6), Y(-10)], [X(12), Y(-10)], [X(16), Y(-20)], [X(12), Y(-28)], [X(8), Y(-28)], [X(7), Y(-18)]], body);
      buf.rect(X(14), Y(-23), 4, 4, col('#fff6c0'));
      buf.rect(X(7), Y(-30), 8, 2, dark);
      wheel(buf, X(16), Y(-6), 6, frame + 1);
      // canopy
      buf.poly([[X(-28), Y(-56)], [X(16), Y(-56)], [X(12), Y(-62)], [X(-24), Y(-62)]], col('#d83a3a'));
      for (let i = -24; i < 14; i += 6) buf.rect(X(i), Y(-62), 3, 6, col('#f0f0f0'));
      buf.rect(X(-28), Y(-56), 44, 1, col('#8a1a1a'));
    }
    return { seat: [-12, -22], bar: [9, -30], foot: [0, -11], w: 52, h: 66, ox, oy };
  }
  // bike (shared bicycle)
  if (layer === 'back') {
    wheel(buf, X(-12), Y(-6), 6, frame, '#c0c4cc');
    buf.line(X(-12), Y(-6), X(0), Y(-7), body);
    buf.line(X(-12), Y(-6), X(-6), Y(-18), body);
    buf.line(X(-6), Y(-18), X(9), Y(-18), body);
    buf.line(X(0), Y(-7), X(-6), Y(-18), body);
    buf.line(X(0), Y(-7), X(9), Y(-18), body);
    buf.rect(X(-9), Y(-20), 6, 2, dark);
    buf.rect(X(10), Y(-22), 8, 5, col('#c0c4cc')); // basket
  } else {
    buf.line(X(9), Y(-18), X(12), Y(-6), body);
    buf.line(X(9), Y(-18), X(8), Y(-24), grey);
    buf.rect(X(5), Y(-25), 6, 1, dark);
    wheel(buf, X(12), Y(-6), 6, frame + 1, '#c0c4cc');
  }
  return { seat: [-6, -19], bar: [7, -25], foot: [0, -9], w: 44, h: 44, ox, oy };
}

export type RiderPoseKind = 'ride' | 'lean' | 'honk' | 'hurt' | 'tuck' | 'phone' | 'throw' | 'umbrella' | 'shout' | 'empty';

function seatedPose(a: Anchor, kind: RiderPoseKind, st: Style, vk: VehicleKind): Pose {
  // pelvis is at origin + (px, -23*s + py); we put origin under seat
  const lean = kind === 'lean' ? 34 : kind === 'hurt' ? -24 : kind === 'honk' ? 8 : vk === 'sport' ? 30 : 16;
  const p: Pose = {
    py: 23 + a.seat[1] - 1,
    lean,
    legF: [100, 0],
    legB: [92, -5],
    armF: [60, 90],
    armB: [55, 85],
    shout: kind === 'honk' || kind === 'shout',
  };
  // legs: knee forward to foot board
  const hipY = a.seat[1] - 1;
  const [lt, ls] = ik(0, hipY, a.foot[0] - a.seat[0], a.foot[1], 11, 11, -1);
  p.legF = [lt, ls];
  p.legB = [lt - 8, ls - 6];
  // arms to handlebar via IK
  const rl = (lean * Math.PI) / 180;
  const nx = Math.sin(rl) * 15;
  const ny = hipY - Math.cos(rl) * 15;
  const shx = nx + Math.cos(rl) * 2;
  const shy = ny + 2;
  if (kind === 'hurt') {
    p.armF = [150, 170];
    p.armB = [130, 160];
  } else if (kind === 'throw') {
    p.armF = [170, 178];
    p.armB = ik(shx - 4, shy, a.bar[0] - a.seat[0], a.bar[1], 9, 8, 1);
  } else if (kind === 'phone') {
    p.armF = [40, 160];
    p.armB = ik(shx - 4, shy, a.bar[0] - a.seat[0], a.bar[1], 9, 8, 1);
    p.headY = -0.5;
    p.headX = 0.6;
  } else if (kind === 'umbrella') {
    p.armF = [150, 175];
    p.armB = ik(shx - 4, shy, a.bar[0] - a.seat[0], a.bar[1], 9, 8, 1);
  } else {
    p.armF = ik(shx, shy, a.bar[0] - a.seat[0] + 1, a.bar[1], 9, 8, 1);
    p.armB = ik(shx - 4, shy, a.bar[0] - a.seat[0] - 2, a.bar[1] + 1, 9, 8, 1);
  }
  return p;
}

const riderCache = new Map<string, RiderSprite>();

/** Rider on vehicle, facing right; glyph is drawn un-mirrored on both orientations. */
export function riderSprite(brand: Brand, vk: VehicleKind, kind: RiderPoseKind, frame: number, scale = 1, style?: Style): RiderSprite {
  const key = `${brand.id}|${vk}|${kind}|${frame}|${scale}|${style ? style.head + style.top : ''}`;
  const c = riderCache.get(key);
  if (c) return c;
  const S = scale;
  const W = Math.ceil(96 * S);
  const Hh = Math.ceil(90 * S);
  const ox = Math.round(52 * S);
  const oy = Math.round(84 * S);
  const buf = new PixelBuf(W, Hh);
  const pnt: Painter = S === 1 ? buf : new ScaledPainter(buf, ox, oy, S);
  const st: Style = { ...(style || riderStyle(brand)) };
  st.scale = (st.scale ?? 1) * S;
  const a = drawVehicle(pnt, vk, brand, ox, oy, frame, 'back');
  const bob = frame % 2 === 1 ? -1 : 0;
  const hx = ox + a.seat[0] * S;
  if (kind !== 'empty') {
    const pose = seatedPose(a, kind, st, vk);
    pose.py = ((pose.py ?? 0) + bob) * S;
    drawHumanoid(buf, hx, oy, pose, st, 'back');
    drawVehicle(pnt, vk, brand, ox, oy, frame, 'front');
    drawHumanoid(buf, hx, oy, pose, st, 'front');
    if (kind === 'umbrella') {
      const ux = a.seat[0] + 10 + ox;
      const uy = oy - 58;
      pnt.line(ux - 2, uy + 22, ux, uy, col('#444'));
      pnt.poly([[ux - 16, uy + 6], [ux + 16, uy + 6], [ux + 10, uy - 2], [ux, uy - 5], [ux - 10, uy - 2]], col('#e03a6a'));
      for (let i = -14; i < 14; i += 7) pnt.line(ux, uy - 4, ux + i, uy + 6, col('#a02048'));
    }
    if (kind === 'phone') {
      pnt.rect(ox + a.seat[0] + 9, oy - 40, 2, 3, col('#101018'));
      pnt.set(ox + a.seat[0] + 10, oy - 40, col('#7ad0ff'));
    }
    if (kind === 'throw') {
      pnt.rect(ox + a.seat[0] - 2, oy - 62, 9, 7, col('#c89a5a'));
    }
  } else {
    drawVehicle(pnt, vk, brand, ox, oy, frame, 'front');
  }
  if (brand.id === 'mod') {
    // 魔改: speakers + LED strip + antenna
    pnt.rect(ox - 30, oy - 46, 8, 10, col('#202028'));
    pnt.circle(ox - 26, oy - 41, 3, col('#5a5a66'));
    pnt.circle(ox - 26, oy - 41, 1, col('#101014'));
    pnt.line(ox - 12, oy - 38, ox - 14, oy - 56, col('#9aa0aa'));
    pnt.rect(ox - 15, oy - 58, 3, 3, col('#ff3a6a'));
    for (let i = 0; i < 6; i++) pnt.set(ox - 20 + i * 6, oy - 10, col(['#ff3a8a', '#3af0ff', '#ffe03a'][(i + frame) % 3]));
  }
  if (brand.id === 'boss1') {
    // stacked boxes of the "单王"
    pnt.rect(ox - 26, oy - 50, 15, 13, col('#ffd21f'));
    pnt.rect(ox - 26, oy - 50, 15, 2, col('#fff08a'));
    pnt.rect(ox - 24, oy - 61, 11, 11, col('#ffc61a'));
    pnt.rect(ox - 30, oy - 66, 2, 30, col('#9aa0aa'));
    pnt.poly([[ox - 29, oy - 66], [ox - 41, oy - 63], [ox - 29, oy - 59]], col('#e02a2a'));
  }
  buf.outline(col(OUTLINE));
  const base = buf.toCanvas();
  const flipped = document.createElement('canvas');
  flipped.width = W;
  flipped.height = Hh;
  const fctx = flipped.getContext('2d')!;
  fctx.translate(W, 0);
  fctx.scale(-1, 1);
  fctx.drawImage(base, 0, 0);
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  if (a.box) {
    const tc = textCanvas(brand.glyph, { size: 12, color: brand.boxText, outline: null });
    const [bx, by, bw, bh] = a.box;
    const gx = Math.round(ox + (bx + bw / 2) * S - tc.width / 2);
    const gy = Math.round(oy + (by + bh / 2) * S - tc.height / 2);
    base.getContext('2d')!.drawImage(tc, gx, gy);
    fctx.drawImage(tc, W - gx - tc.width, gy);
  }
  const s: RiderSprite = { c: base, flipped, ox, oy, w: a.w * S };
  riderCache.set(key, s);
  return s;
}

/** Rider without vehicle (standing / tumbling / sitting) */
export function riderBody(brand: Brand, pose: Pose, scale = 1): Sprite {
  const key = `body|${brand.id}|${JSON.stringify(pose)}|${scale}`;
  const c = riderCache.get(key);
  if (c) return c;
  const buf = new PixelBuf(80, 80);
  const st = riderStyle(brand);
  st.scale = scale;
  drawHumanoid(buf, 40, 74, pose, st);
  buf.outline(col(OUTLINE));
  const s = makeSprite(buf, 40, 74) as RiderSprite;
  s.w = 20;
  riderCache.set(key, s);
  return s;
}

export const RIDER_POSES: Record<string, Pose> = {
  tumble: { py: -4, lean: 40, legF: [110, -10], legB: [95, -25], armF: [90, 150], armB: [70, 160] },
  sit: { py: 14, lean: -6, legF: [85, 80], legB: [80, 70], armF: [-20, -10], armB: [-30, -20], dizzy: true },
  stand: { py: 1, lean: 0, legF: [8, 2], legB: [-8, -2], armF: [10, 40], armB: [-5, 20] },
  wave: { py: 1, lean: 0, legF: [8, 2], legB: [-8, -2], armF: [150, 175], armB: [-5, 20] },
  walk1: { py: 1, lean: 4, legF: [20, 10], legB: [-18, -20], armF: [55, 70], armB: [45, 60] },
  walk2: { py: 0, lean: 4, legF: [-10, -25], legB: [15, 5], armF: [55, 70], armB: [45, 60] },
  bow: { py: 1, lean: 40, legF: [5, 0], legB: [-5, 0], armF: [30, 10], armB: [20, 0] },
};

export function vehicleOnly(brand: Brand, vk: VehicleKind, frame = 0): RiderSprite {
  return riderSprite(brand, vk, 'empty', frame);
}
