// Hero ("阿龙") sprite generation from skeletal poses.
import { PixelBuf, Sprite, makeSprite, col } from '../core/gfx';
import { drawHumanoid, Pose, Style, OUTLINE, RenderInfo } from './humanoid';

export const HERO_STYLE: Style = {
  skin: '#eaa877',
  top: '#f2f0e6',
  pants: '#2c3050',
  shoes: '#3a2a22',
  head: 'hero',
  tank: true,
  belt: '#151520',
  headband: '#e42a2a',
  bulk: 1.12,
};

export interface HeroSprite extends Sprite {
  fist: [number, number]; // front fist offset from anchor (facing right)
  fistB: [number, number];
  head: [number, number];
}

const BW = 96;
const BH = 84;
const OX = 48;
const OY = 78;

export function renderPose(pose: Pose, style: Style, w = BW, h = BH, ox = OX, oy = OY): HeroSprite {
  const buf = new PixelBuf(w, h);
  const info: RenderInfo = drawHumanoid(buf, ox, oy, pose, style);
  buf.outline(col(style.outline || OUTLINE));
  const s = makeSprite(buf, ox, oy) as HeroSprite;
  s.fist = [info.fistF[0] - ox, info.fistF[1] - oy];
  s.fistB = [info.fistB[0] - ox, info.fistB[1] - oy];
  s.head = [info.head[0] - ox, info.head[1] - oy];
  return s;
}

const S = Math.sin;
const stance = (b = 0, tail = 0): Pose => ({
  py: 1.5 + b,
  lean: 4,
  armF: [38, 148],
  armB: [18, 162],
  legF: [24, -2],
  legB: [-22, -10],
  tail,
});

export const HERO_POSES: Record<string, Pose[]> = {};

function build() {
  const P = HERO_POSES;
  P.idle = [0, 1, 2, 1].map((i) => {
    const p = stance(i * 0.5, i * 1.6);
    p.armF = [38 - i * 2, 148 + i * 2];
    return p;
  });
  P.walk = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    const a = 26 * S(t);
    const b = 26 * S(t + Math.PI);
    P.walk.push({
      py: 1 - Math.abs(S(t)) * 1.5 + 1,
      lean: 6,
      armF: [34 + 8 * S(t + Math.PI), 145],
      armB: [16 + 8 * S(t), 160],
      legF: [a, a - Math.max(0, 28 * Math.cos(t))],
      legB: [b, b - Math.max(0, 28 * Math.cos(t + Math.PI))],
      tail: i * 0.8,
    });
  }
  P.run = [];
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    const a = 42 * S(t);
    const b = 42 * S(t + Math.PI);
    P.run.push({
      py: 1 - Math.abs(S(t)) * 2.5 + 1,
      lean: 16,
      armF: [10 + 50 * S(t + Math.PI), 120 + 30 * S(t + Math.PI)],
      armB: [10 + 50 * S(t), 120 + 30 * S(t)],
      legF: [a + 10, a + 10 - Math.max(0, 60 * Math.cos(t)) - 10],
      legB: [b + 10, b + 10 - Math.max(0, 60 * Math.cos(t + Math.PI)) - 10],
      tail: i * 1.4,
    });
  }
  // jab: windup, hit, hold, retract
  P.jab = [
    { ...stance(0.5), lean: 6, armF: [55, 120] },
    { ...stance(0.5), lean: 10, armF: [88, 90], legF: [30, 0], shout: true },
    { ...stance(0.5), lean: 10, armF: [88, 90], legF: [30, 0] },
    { ...stance(0.5), lean: 6, armF: [60, 125] },
  ];
  P.cross = [
    { ...stance(1), lean: 8, armB: [40, 120], armF: [30, 150] },
    { ...stance(1), lean: 18, armB: [86, 88], armF: [10, 140], legF: [34, 4], legB: [-28, -14], shout: true },
    { ...stance(1), lean: 18, armB: [86, 88], armF: [10, 140], legF: [34, 4], legB: [-28, -14] },
    { ...stance(1), lean: 10, armB: [50, 120], armF: [30, 150] },
  ];
  P.upper = [
    { ...stance(4), lean: 18, armF: [15, 55], armB: [20, 150], legF: [40, -10], legB: [-30, -20] },
    { ...stance(-3), lean: -4, armF: [150, 172], armB: [10, 140], legF: [14, 0], legB: [-14, -6], shout: true },
    { ...stance(-4), lean: -6, armF: [168, 178], armB: [5, 130], legF: [10, 0], legB: [-12, -4], shout: true },
    { ...stance(0), lean: 2, armF: [110, 150], armB: [15, 150] },
  ];
  P.kick = [
    { ...stance(0), lean: -5, legF: [85, -20], armF: [40, 150], armB: [-10, 120] },
    { ...stance(-2), lean: -24, legF: [96, 96], legB: [-6, -4], armF: [30, 140], armB: [-30, 90], shout: true },
    { ...stance(-2), lean: -24, legF: [96, 96], legB: [-6, -4], armF: [30, 140], armB: [-30, 90] },
    { ...stance(0), lean: -8, legF: [70, -10], armF: [40, 150], armB: [-10, 120] },
  ];
  P.flykick = [
    { py: -2, lean: -16, legF: [92, 92], legB: [30, -80], armF: [40, 150], armB: [-40, 80], tail: 2, shout: true },
    { py: -2, lean: -16, legF: [92, 92], legB: [30, -80], armF: [40, 150], armB: [-40, 80], tail: 4 },
  ];
  P.jump = [
    { py: -2, lean: 4, legF: [70, -20], legB: [40, -40], armF: [70, 150], armB: [-20, 120], tail: 1 },
    { py: -2, lean: 4, legF: [80, -10], legB: [50, -40], armF: [80, 160], armB: [-30, 120], tail: 3 },
  ];
  P.airkick = [{ py: -2, lean: -6, legF: [55, 55], legB: [40, -60], armF: [50, 150], armB: [-30, 110], tail: 2, shout: true }];
  P.airpunch = [{ py: -2, lean: 14, legF: [60, -30], legB: [30, -50], armF: [65, 65], armB: [10, 140], tail: 2, shout: true }];
  P.roll = [0, 90, 180, 270].map((r) => ({
    py: 8,
    lean: 40,
    legF: [110, -10] as [number, number],
    legB: [95, -25] as [number, number],
    armF: [90, 150] as [number, number],
    armB: [70, 160] as [number, number],
    rot: r,
  }));
  P.hurt = [
    { ...stance(1), lean: -18, armF: [-10, -40], armB: [-35, -60], headX: -1 },
    { ...stance(1), lean: -12, armF: [0, 60], armB: [-20, 40], headX: -1 },
  ];
  P.fall = [
    { py: 0, lean: -10, rot: -40, armF: [150, 170], armB: [130, 150], legF: [40, 20], legB: [10, 0], tail: 3 },
    { py: 4, lean: -10, rot: -70, armF: [160, 175], armB: [140, 160], legF: [30, 10], legB: [5, 0], tail: 5 },
  ];
  P.down = [{ py: 20, lean: 0, rot: -90, armF: [150, 165], armB: [170, 175], legF: [8, 4], legB: [-6, 0], eyesClosed: true }];
  P.getup = [
    { py: 12, lean: 40, legF: [85, 0], legB: [70, -20], armF: [10, 20], armB: [-10, 0] },
    { py: 6, lean: 25, legF: [55, -10], legB: [-10, -30], armF: [30, 120], armB: [10, 140] },
  ];
  P.charge = [0, 1].map((i) => ({
    py: 3,
    lean: -6,
    legF: [36, 2] as [number, number],
    legB: [-36, -8] as [number, number],
    armF: [-35 + i * 3, 30] as [number, number],
    armB: [-50 + i * 3, 15] as [number, number],
    openF: true,
    tail: i * 3,
    shout: i === 1,
  }));
  P.hadoken = [
    { py: 3, lean: 14, legF: [44, 12], legB: [-38, -18], armF: [86, 90], armB: [80, 86], openF: true, shout: true, tail: 2 },
    { py: 3, lean: 12, legF: [44, 12], legB: [-38, -18], armF: [84, 90], armB: [78, 86], openF: true, shout: true, tail: 4 },
  ];
  P.efist = [
    { ...stance(2), lean: 0, armF: [-20, 60], armB: [30, 150], legF: [30, 0] },
    { py: 2.5, lean: 20, legF: [48, 14], legB: [-40, -22], armF: [88, 90], armB: [5, 140], shout: true, tail: 3 },
  ];
  P.grab = [{ ...stance(0.5), lean: 12, armF: [72, 60], armB: [62, 52] }];
  P.knee = [{ ...stance(0), lean: 14, armF: [72, 60], armB: [62, 52], legF: [90, -30] }];
  P.lift = [
    { ...stance(3), lean: 4, armF: [120, 160], armB: [115, 150], legF: [32, -4], legB: [-30, -10] },
    { ...stance(1), lean: -6, armF: [172, 178], armB: [168, 176], legF: [26, 0], legB: [-26, -8], shout: true },
  ];
  P.throw = [{ ...stance(1), lean: 26, armF: [100, 92], armB: [94, 86], legF: [40, 8], legB: [-34, -16], shout: true }];
  P.carry = P.walk.map((p) => ({ ...p, armF: [172, 178] as [number, number], armB: [168, 176] as [number, number], lean: 0 }));
  P.carryIdle = [{ ...stance(0), armF: [172, 178], armB: [168, 176], lean: 0 }];
  P.pickup = [{ py: 9, lean: 45, legF: [70, -10], legB: [20, -40], armF: [15, 0], armB: [5, -5] }];
  P.victory = [
    { ...stance(0), lean: -4, armF: [170, 178], armB: [-25, 60], shout: true },
    { ...stance(-1), lean: -6, armF: [172, 180], armB: [-25, 60], shout: true, tail: 2 },
  ];
  P.spin = [
    { ...stance(-3), lean: -20, legF: [100, 100], legB: [-5, -4], armF: [80, 90], armB: [-80, -90] },
    { ...stance(-3), lean: -20, legF: [100, 100], legB: [-5, -4], armF: [80, 90], armB: [-80, -90], tail: 3 },
  ];
  P.dead = P.down.map((p) => ({ ...p, eyesClosed: true }));
  // title-screen/cutscene look-back pose
  P.ready = [{ ...stance(0), lean: 2, armF: [20, 100], armB: [-15, 60] }];
}
build();

export const HERO: Record<string, HeroSprite[]> = {};
export function buildHeroSprites() {
  for (const [k, poses] of Object.entries(HERO_POSES)) HERO[k] = poses.map((p) => renderPose(p, HERO_STYLE));
}
