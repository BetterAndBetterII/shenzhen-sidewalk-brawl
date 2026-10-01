// Ambient pedestrians strolling past the shopfronts — the sidewalk is supposed to be crowded.
// Purely decorative: they hop and yelp when a rider whizzes by.
import { drawSprite, rand, W } from '../core/gfx';
import { drawText } from '../core/text';
import { HERO_POSES, HeroSprite, renderPose } from '../art/hero';
import type { Style } from '../art/humanoid';
import { Z_MIN } from '../art/backgrounds';
import type { World } from './world';
import { Rider } from './enemies';

const STYLES: Style[] = [
  { skin: '#e8b48a', top: '#f0f0f4', pants: '#2a2a3a', shoes: '#1a1a20', head: 'manager', hair: '#1a1418', tie: '#2a5ad0', glasses: true, sleeves: true, bulk: 0.9, scale: 0.82 },
  { skin: '#d89a6a', top: '#d04a7a', pants: '#3a3a4a', shoes: '#2a2224', head: 'hair', hair: '#2a1a18', sleeves: true, bulk: 0.95, scale: 0.78 },
  { skin: '#eaa877', top: '#3a6ad0', pants: '#22242e', shoes: '#e8e8e8', head: 'hair', hair: '#141018', sleeves: true, bulk: 0.85, scale: 0.8 },
  { skin: '#c88a5a', top: '#8a7a5a', pants: '#4a4034', shoes: '#2a2224', head: 'bald', sleeves: false, bulk: 1.0, scale: 0.8 },
  { skin: '#e8b48a', top: '#e07a2a', pants: '#2a3a5a', shoes: '#2a2224', head: 'cap', helmet: '#f0f0f0', sleeves: true, bulk: 0.95, scale: 0.8 },
  { skin: '#f0c8a0', top: '#ffd0e0', pants: '#5a4a6a', shoes: '#ffffff', head: 'hair', hair: '#5a3020', sleeves: false, bulk: 0.85, scale: 0.76 },
  { skin: '#d8a070', top: '#3aa05a', pants: '#2a2a30', shoes: '#2a2224', head: 'hair', hair: '#1a1418', sleeves: true, bulk: 0.95, scale: 0.84 },
];

let SETS: HeroSprite[][] | null = null;
function sets(): HeroSprite[][] {
  if (!SETS)
    SETS = STYLES.map((st) =>
      HERO_POSES.walk.map((p, i) => {
        // relaxed civilian walk: arms swing low instead of the hero's fighting guard
        const sw = Math.sin((i / 8) * Math.PI * 2) * 22;
        return renderPose({ ...p, lean: 1, armF: [-sw, -sw + 14], armB: [sw, sw + 14], tail: 0 }, { ...st, scale: (st.scale || 0.8) * 0.9 });
      }),
    );
  return SETS;
}

interface Ped {
  x: number;
  z: number;
  v: number;
  set: number;
  f: number;
  hop: number;
  wait: number;
  yelp: string;
  yelpT: number;
}

const YELPS = ['哇!', '吓死我了', '看路啊!', '慢点!', '我的奶茶!', '哎哟!'];

export class Crowd {
  peds: Ped[] = [];
  constructor(
    public count: number,
    camX: number,
  ) {
    sets();
    for (let i = 0; i < count; i++) this.peds.push(this.make(camX - 60 + rand(0, W + 120)));
  }
  private make(x: number): Ped {
    const v = (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.55);
    return { x, z: Z_MIN - rand(1, 5), v, set: Math.floor(rand(0, STYLES.length)), f: rand(0, 8), hop: 0, wait: 0, yelp: '', yelpT: 0 };
  }
  update(w: World) {
    const camX = w.camX;
    for (const p of this.peds) {
      if (p.wait > 0) p.wait--;
      else {
        p.x += p.v;
        p.f += Math.abs(p.v) * 0.18;
        if (Math.random() < 0.002) p.wait = Math.floor(rand(40, 140)); // window shopping
      }
      if (p.hop > 0) p.hop--;
      if (p.yelpT > 0) p.yelpT--;
      // riders zooming past along the back of the sidewalk startle people
      if (p.hop === 0 && w.frames % 6 === 0) {
        for (const e of w.enemies) {
          if (!(e instanceof Rider) || e.dead || Math.abs(e.vx) < 2.4 || e.z > Z_MIN + 26) continue;
          if (Math.abs(e.x - p.x) < 26) {
            p.hop = 16;
            if (Math.random() < 0.35) {
              p.yelp = YELPS[Math.floor(Math.random() * YELPS.length)];
              p.yelpT = 50;
            }
            break;
          }
        }
      }
      // recycle when far off-screen
      if (p.x < camX - 140 || p.x > camX + W + 140) {
        const fromLeft = Math.random() < 0.5;
        Object.assign(p, this.make(fromLeft ? camX - 50 : camX + W + 50));
        p.v = Math.abs(p.v) * (fromLeft ? 1 : -1);
      }
    }
  }
  draw(ctx: CanvasRenderingContext2D, camX: number) {
    const S = sets();
    const sorted = [...this.peds].sort((a, b) => a.z - b.z);
    for (const p of sorted) {
      const fr = S[p.set][p.wait > 0 ? 0 : Math.floor(p.f) % 8];
      const hy = p.hop > 0 ? Math.round(Math.sin((p.hop / 16) * Math.PI) * 6) : 0;
      const sx = p.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.fillStyle = 'rgba(10,8,20,0.25)';
      ctx.fillRect(Math.round(sx - 6), Math.round(p.z - 1), 12, 2);
      drawSprite(ctx, fr, sx, p.z - hy, p.v < 0);
      if (p.yelpT > 0) drawText(ctx, p.yelp, Math.round(sx), Math.round(p.z - 52 - hy), { size: 8, color: '#ffffff', align: 'center' });
    }
  }
}
