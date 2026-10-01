// Procedural skeletal pixel-art humanoid renderer.
// Angles are degrees measured from straight down; positive rotates toward facing (+x).
import { col, PixelBuf, shadeHex } from '../core/gfx';

export interface Pose {
  px?: number;
  py?: number;
  lean?: number;
  armF: [number, number];
  armB: [number, number];
  legF: [number, number];
  legB: [number, number];
  rot?: number;
  headX?: number;
  headY?: number;
  tail?: number; // headband flutter phase
  shout?: boolean;
  openF?: boolean; // open palm
  eyesClosed?: boolean;
  dizzy?: boolean;
}

export interface Style {
  skin: string;
  top: string;
  pants: string;
  shoes: string;
  head: 'hero' | 'helmet' | 'cap' | 'bald' | 'manager' | 'hair';
  hair?: string;
  helmet?: string;
  visor?: string;
  sleeves?: boolean; // arms covered by top color
  tank?: boolean; // tank top showing shoulders
  gloves?: string;
  belt?: string;
  scale?: number;
  bulk?: number;
  headband?: string;
  tie?: string;
  vest?: string; // reflective vest stripe
  outline?: string;
  glasses?: boolean;
}

export const OUTLINE = '#140c18';

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (a: number): [number, number] => [Math.sin(rad(a)), Math.cos(rad(a))];

export interface RenderInfo {
  fistF: [number, number];
  fistB: [number, number];
  head: [number, number];
  pelvis: [number, number];
  footF: [number, number];
}

export function ik(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bend = 1): [number, number] {
  const dx = tx - sx;
  const dy = ty - sy;
  let d = Math.hypot(dx, dy);
  d = Math.min(d, l1 + l2 - 0.01);
  const base = Math.atan2(dx, dy); // angle from down
  const a1 = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const upper = base - bend * a1;
  const ex = sx + Math.sin(upper) * l1;
  const ey = sy + Math.cos(upper) * l1;
  const lower = Math.atan2(tx - ex, ty - ey);
  return [(upper * 180) / Math.PI, (lower * 180) / Math.PI];
}

/** Draw humanoid into buf with feet-origin at (ox, oy). Returns key points. */
export function drawHumanoid(buf: PixelBuf, ox: number, oy: number, pose: Pose, st: Style, layer: 'all' | 'back' | 'front' = 'all'): RenderInfo {
  const s = st.scale ?? 1;
  const bk = st.bulk ?? 1;
  const L = {
    thigh: 11 * s,
    shin: 11 * s,
    torso: 15 * s,
    upper: 9 * s,
    fore: 8 * s,
    headR: 4.6 * s,
  };
  const rot = pose.rot ?? 0;
  const P: [number, number] = [ox + (pose.px ?? 0), oy - 23 * s + (pose.py ?? 0)];
  const rp = (x: number, y: number): [number, number] => {
    if (!rot) return [x, y];
    const c = Math.cos(rad(rot));
    const sn = Math.sin(rad(rot));
    const dx = x - P[0];
    const dy = y - P[1];
    // rotating "forward" (clockwise on screen for facing right)
    return [P[0] + dx * c - dy * sn, P[1] + dx * sn + dy * c];
  };
  const lean = pose.lean ?? 0;
  const up: [number, number] = [Math.sin(rad(lean)), -Math.cos(rad(lean))];
  const fw: [number, number] = [-up[1], up[0]]; // perpendicular, forward
  const N: [number, number] = [P[0] + up[0] * L.torso, P[1] + up[1] * L.torso];

  const skin = st.skin;
  const skinD = shadeHex(skin, -0.25);
  const skinL = shadeHex(skin, 0.18);
  const topC = st.top;
  const topD = shadeHex(topC, -0.22);
  const topL = shadeHex(topC, 0.2);
  const pants = st.pants;
  const pantsD = shadeHex(pants, -0.3);
  const pantsL = shadeHex(pants, 0.18);

  const C = (h: string) => col(h);

  const limb = (a: [number, number], b: [number, number], r: number, base: string, dark: string, light?: string) => {
    const A = rp(a[0], a[1]);
    const B = rp(b[0], b[1]);
    buf.thick(A[0], A[1], B[0], B[1], r, C(dark));
    if (r >= 1.5) buf.thick(A[0] - 0.6, A[1] - 0.6, B[0] - 0.6, B[1] - 0.6, Math.max(0.6, r - 0.9), C(base));
    if (light && r >= 2) buf.thick(A[0] - 1.2, A[1] - 1.0, B[0] - 1.0, B[1] - 1.0, 0.5, C(light));
  };

  const leg = (front: boolean) => {
    const [ta, sa] = front ? pose.legF : pose.legB;
    const hip: [number, number] = [P[0] + fw[0] * (front ? 1.5 : -1.5) * s, P[1] + 1];
    const kd = dir(ta);
    const K: [number, number] = [hip[0] + kd[0] * L.thigh, hip[1] + kd[1] * L.thigh];
    const ad = dir(sa);
    const A: [number, number] = [K[0] + ad[0] * L.shin, K[1] + ad[1] * L.shin];
    const pc = front ? pants : pantsD;
    const pd = front ? pantsD : shadeHex(pants, -0.45);
    limb(hip, K, 3.2 * s * bk, pc, pd, front ? pantsL : undefined);
    limb(K, A, 2.6 * s * bk, pc, pd, front ? pantsL : undefined);
    // foot: points perpendicular-forward to shin
    const fx = Math.cos(rad(sa)) * 1;
    const fy = -Math.sin(rad(sa)) * 1;
    const T: [number, number] = [A[0] + fx * 4 * s, A[1] + fy * 4 * s];
    const shoe = front ? st.shoes : shadeHex(st.shoes, -0.3);
    limb([A[0] - fx * 0.5, A[1] - fy * 0.5], T, 1.6 * s, shoe, shadeHex(shoe, -0.35));
    return rp(A[0], A[1]);
  };

  const arm = (front: boolean): [number, number] => {
    const [ua, la] = front ? pose.armF : pose.armB;
    const Sh: [number, number] = [N[0] + fw[0] * (front ? 2 : -2.5) * s - up[0] * 2 * s, N[1] + fw[1] * (front ? 2 : -2.5) * s - up[1] * 2 * s];
    const ed = dir(ua);
    const E: [number, number] = [Sh[0] + ed[0] * L.upper, Sh[1] + ed[1] * L.upper];
    const hd = dir(la);
    const Hd: [number, number] = [E[0] + hd[0] * L.fore, E[1] + hd[1] * L.fore];
    const armC = st.sleeves ? (front ? topC : topD) : front ? skin : skinD;
    const armD = st.sleeves ? (front ? topD : shadeHex(topC, -0.4)) : front ? skinD : shadeHex(skin, -0.4);
    limb(Sh, E, 2.7 * s * bk, armC, armD, front && !st.sleeves ? skinL : undefined);
    limb(E, Hd, 2.2 * s * bk, armC, armD, front && !st.sleeves ? skinL : undefined);
    // fist
    const handC = st.gloves || (front ? skin : skinD);
    const F = rp(Hd[0] + hd[0] * 1.2, Hd[1] + hd[1] * 1.2);
    buf.circle(F[0], F[1], 2.3 * s * (pose.openF && front ? 0.8 : 1) * Math.min(1.2, bk), C(shadeHex(handC, -0.25)));
    buf.circle(F[0] - 0.5, F[1] - 0.5, 1.6 * s * Math.min(1.2, bk), C(handC));
    if (st.tank && !st.sleeves) {
      // deltoid
      const Sp = rp(Sh[0], Sh[1]);
      buf.circle(Sp[0], Sp[1], 2.9 * s * bk, C(front ? skin : skinD));
      if (front) buf.set(Sp[0] - 1, Sp[1] - 1, C(skinL));
    } else if (st.sleeves) {
      const Sp = rp(Sh[0], Sh[1]);
      buf.circle(Sp[0], Sp[1], 2.8 * s * bk, C(front ? topC : topD));
    }
    return F;
  };

  const torso = () => {
    const sw = 6.2 * s * bk;
    const ww = 4.6 * s * bk;
    const sh1 = [N[0] + fw[0] * sw, N[1] + fw[1] * sw];
    const sh2 = [N[0] - fw[0] * sw, N[1] - fw[1] * sw];
    const w1 = [P[0] + fw[0] * ww, P[1] + fw[1] * ww];
    const w2 = [P[0] - fw[0] * ww, P[1] - fw[1] * ww];
    const pts = [sh1, sh2, w2, w1].map((p) => rp(p[0], p[1]));
    // hips / pants block
    const h1 = rp(P[0] + fw[0] * 5 * s * bk, P[1] + fw[1] * 5 * s * bk + 3 * s);
    const h2 = rp(P[0] - fw[0] * 5 * s * bk, P[1] - fw[1] * 5 * s * bk + 3 * s);
    const wa = rp(w1[0], w1[1]);
    const wb = rp(w2[0], w2[1]);
    buf.poly([wa, wb, h2, h1], C(pants));
    if (st.tank) {
      // skin torso then tank top
      buf.poly(pts, C(skin));
      const t1 = rp(N[0] + fw[0] * 3.6 * s + up[0] * -1.5, N[1] + fw[1] * 3.6 * s - up[1] * 1.5);
      const t2 = rp(N[0] - fw[0] * 3.8 * s + up[0] * -1.5, N[1] - fw[1] * 3.8 * s - up[1] * 1.5);
      const c1 = rp(N[0] + fw[0] * 5.5 * s - up[0] * 4 * s, N[1] + fw[1] * 5.5 * s - up[1] * 4 * s);
      const c2 = rp(N[0] - fw[0] * 5.5 * s - up[0] * 4 * s, N[1] - fw[1] * 5.5 * s - up[1] * 4 * s);
      buf.poly([t1, c1, wa, wb, c2, t2], C(topC));
      // shading on back half
      const m1 = rp(N[0] - fw[0] * 1 * s - up[0] * 4 * s, N[1] - fw[1] * 1 * s - up[1] * 4 * s);
      const m2 = rp(P[0] - fw[0] * 1.5 * s, P[1] - fw[1] * 1.5 * s);
      buf.poly([m1, c2, wb, m2], C(topD));
      // pec line
      const pl = rp(N[0] + fw[0] * 1 * s - up[0] * 6 * s, N[1] + fw[1] * 1 * s - up[1] * 6 * s);
      const pr = rp(N[0] + fw[0] * 4.5 * s - up[0] * 6.5 * s, N[1] + fw[1] * 4.5 * s - up[1] * 6.5 * s);
      buf.line(pl[0], pl[1], pr[0], pr[1], C(shadeHex(topC, -0.12)));
    } else {
      buf.poly(pts, C(topC));
      const m1 = rp(N[0] - fw[0] * 1 * s, N[1] - fw[1] * 1 * s);
      const m2 = rp(P[0] - fw[0] * 1 * s, P[1] - fw[1] * 1 * s);
      const s2 = pts[1];
      buf.poly([m1, s2, wb, m2], C(topD));
      const hl1 = rp(N[0] + fw[0] * 4.5 * s - up[0] * 2, N[1] + fw[1] * 4.5 * s - up[1] * 2);
      const hl2 = rp(P[0] + fw[0] * 3.5 * s - up[0] * 3, P[1] + fw[1] * 3.5 * s - up[1] * 3);
      buf.line(hl1[0], hl1[1], hl2[0], hl2[1], C(topL));
      if (st.vest) {
        const v1 = rp(N[0] + fw[0] * 6 * s - up[0] * 8 * s, N[1] + fw[1] * 6 * s - up[1] * 8 * s);
        const v2 = rp(N[0] - fw[0] * 6 * s - up[0] * 8 * s, N[1] - fw[1] * 6 * s - up[1] * 8 * s);
        buf.thick(v1[0], v1[1], v2[0], v2[1], 0.6 * s, C(st.vest));
      }
      if (st.tie) {
        const a = rp(N[0] + fw[0] * 3 * s - up[0] * 1, N[1] + fw[1] * 3 * s - up[1] * 1);
        const b = rp(N[0] + fw[0] * 3.5 * s - up[0] * 10 * s, N[1] + fw[1] * 3.5 * s - up[1] * 10 * s);
        buf.thick(a[0], a[1], b[0], b[1], 0.8 * s, C(st.tie));
      }
    }
    // belt
    if (st.belt) {
      const b1 = rp(P[0] + fw[0] * 4.8 * s * bk, P[1] + fw[1] * 4.8 * s * bk);
      const b2 = rp(P[0] - fw[0] * 4.8 * s * bk, P[1] - fw[1] * 4.8 * s * bk);
      buf.thick(b1[0], b1[1], b2[0], b2[1], 0.7 * s, C(st.belt));
    }
  };

  const head = (): [number, number] => {
    const hx = N[0] + up[0] * (L.headR + 1.5 * s) + (pose.headX ?? 0) * s;
    const hy = N[1] + up[1] * (L.headR + 1.5 * s) + (pose.headY ?? 0) * s;
    const [Hx, Hy] = rp(hx, hy);
    const r = L.headR;
    // neck
    const Nn = rp(N[0], N[1]);
    buf.thick(Nn[0], Nn[1], Hx - 0.5, Hy + 1, 1.8 * s * Math.min(bk, 1.2), C(skinD));
    const fwx = Math.cos(rad(rot));
    const fwy = Math.sin(rad(rot));
    const upx = Math.sin(rad(rot));
    const upy = -Math.cos(rad(rot));
    const at = (f: number, u: number): [number, number] => [Hx + fwx * f + upx * u, Hy + fwy * f + upy * u];
    if (st.head === 'helmet') {
      buf.circle(Hx, Hy, r + 0.6 * s, C(shadeHex(st.helmet || '#ffcc00', -0.3)));
      buf.circle(Hx - 0.5, Hy - 0.6, r - 0.2 * s, C(st.helmet || '#ffcc00'));
      const hl = at(-1.5 * s, 2.6 * s);
      buf.set(hl[0], hl[1], C(shadeHex(st.helmet || '#ffcc00', 0.5)));
      buf.set(hl[0] + 1, hl[1], C(shadeHex(st.helmet || '#ffcc00', 0.5)));
      // visor
      const v1 = at(1.2 * s, 1.2 * s);
      const v2 = at(r + 0.6 * s, -0.8 * s);
      buf.thick(v1[0], v1[1], v2[0], v2[1], 1.3 * s, C(st.visor || '#30384a'));
      const vh = at(r - 0.3 * s, 0.4 * s);
      buf.set(vh[0], vh[1], C(st.visor === '#ff2244' ? '#ffd0d8' : '#a8d8ff'));
      // chin skin
      const ch = at(2 * s, -2.6 * s);
      buf.circle(ch[0], ch[1], 1.4 * s, C(skin));
    } else {
      buf.circle(Hx, Hy, r, C(skinD));
      buf.circle(Hx + fwx * 0.6, Hy - 0.6, r - 0.8, C(skin));
      // jaw/nose
      const nz = at(r - 0.3, -0.4 * s);
      buf.set(nz[0], nz[1], C(skin));
      const ey = at(r * 0.45, 0.6 * s);
      if (pose.dizzy) {
        buf.set(ey[0], ey[1], C('#ffffff'));
        buf.set(ey[0] + 1, ey[1] + 1, C('#ffffff'));
      } else buf.set(ey[0], ey[1], C(pose.eyesClosed ? skinD : '#1a1010'));
      const eb = at(r * 0.45, 1.6 * s);
      buf.set(eb[0], eb[1], C('#2a1a14'));
      buf.set(eb[0] + fwx, eb[1] + fwy, C('#2a1a14'));
      if (pose.shout) {
        const mo = at(r * 0.6, -2 * s);
        buf.rect(mo[0], mo[1], 2, 2, C('#6a1018'));
      } else {
        const mo = at(r * 0.7, -2.1 * s);
        buf.set(mo[0], mo[1], C(skinD));
      }
      if (st.glasses) {
        const g = at(r * 0.5, 0.6 * s);
        buf.rect(g[0] - 1, g[1] - 1, 3, 2, C('#202030'));
      }
      const hairC = st.hair || '#1a1418';
      if (st.head === 'hero') {
        // spiky black hair on top/back
        for (let i = -5; i <= 3; i++) {
          const a = at(i * 0.9 * s - 0.5, r * 0.55);
          buf.circle(a[0], a[1], 1.4 * s, C(hairC));
        }
        const sp = [
          [-4, 6.5],
          [-1.5, 7],
          [1.2, 6.6],
          [-5.6, 4.5],
          [3, 5.3],
        ];
        for (const [f, u] of sp) {
          const a = at(f * s, u * s);
          const b = at(f * s * 0.6, u * s * 0.6);
          buf.thick(a[0], a[1], b[0], b[1], 0.7 * s, C(hairC));
        }
        const back = at(-r + 0.2, -0.2);
        buf.circle(back[0], back[1], 2 * s, C(hairC));
        // headband
        const hb = st.headband || '#e02828';
        const b1 = at(-r - 0.3, 2.2 * s);
        const b2 = at(r + 0.2, 2.6 * s);
        buf.thick(b1[0], b1[1], b2[0], b2[1], 0.9 * s, C(hb));
        // tails
        const ph = pose.tail ?? 0;
        for (let k = 0; k < 2; k++) {
          let tx = b1[0];
          let ty = b1[1] + k;
          for (let i = 1; i <= 6; i++) {
            const nx = b1[0] - fwx * i * 1.6 * s + Math.sin(ph + i * 0.9 + k) * 0.5;
            const ny = b1[1] + k * 1.2 + Math.sin(ph * 1.3 + i * 0.8 + k * 2) * (0.6 + i * 0.35) + i * 0.35;
            buf.thick(tx, ty, nx, ny, 0.6, C(i > 4 ? shadeHex(hb, -0.25) : hb));
            tx = nx;
            ty = ny;
          }
        }
      } else if (st.head === 'cap') {
        const c1 = at(-r, 1.5 * s);
        buf.circle(Hx - fwx * 0.5, Hy - 1.2 * s, r - 0.3, C(st.helmet || '#3060c0'));
        buf.rect(Hx - r, Hy - 0.5 * s, r * 2, 2, C(skin));
        const bill = at(r + 2.5 * s, 1.6 * s);
        buf.thick(c1[0] + fwx * r, c1[1], bill[0], bill[1], 0.8 * s, C(shadeHex(st.helmet || '#3060c0', -0.3)));
      } else if (st.head === 'manager' || st.head === 'hair') {
        // side-parted hair
        for (let i = -5; i <= 3; i++) {
          const a = at(i * 0.85 * s - 0.6, r * 0.6);
          buf.circle(a[0], a[1], 1.5 * s, C(hairC));
        }
        const back = at(-r + 0.5, 0.3);
        buf.circle(back[0], back[1], 2.3 * s, C(hairC));
        if (st.head === 'manager') {
          const sh = at(0, r * 0.9);
          buf.set(sh[0], sh[1], C(shadeHex(hairC, 0.4)));
        }
      } else if (st.head === 'bald') {
        const sh = at(-0.5, r * 0.6);
        buf.set(sh[0], sh[1], C(skinL));
        const back = at(-r + 0.5, -0.6);
        buf.circle(back[0], back[1], 1.4 * s, C(st.hair || '#3a3030'));
      }
    }
    return [Hx, Hy];
  };

  let fistB: [number, number] = [0, 0];
  let fistF: [number, number] = [0, 0];
  let footF: [number, number] = [0, 0];
  let hd: [number, number] = [0, 0];
  if (layer !== 'front') {
    leg(false);
    fistB = arm(false);
  }
  if (layer !== 'back') {
    torso();
    hd = head();
    footF = leg(true);
    fistF = arm(true);
  }
  const Pp = rp(P[0], P[1]);
  return { fistF, fistB, head: hd, pelvis: Pp, footF };
}
