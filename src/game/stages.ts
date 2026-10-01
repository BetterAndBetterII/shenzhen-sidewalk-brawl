// Stage definitions: 7 stages through a Shenzhen day.
import type { RiderType } from './enemies';
import type { PropKind } from './objects';

export interface Group {
  types: RiderType[];
}
export interface Segment {
  at: number; // camera x where the screen locks
  groups: Group[];
}
export interface StageDef {
  idx: number;
  name: string;
  place: string;
  time: string;
  theme: string;
  music: string;
  length: number;
  segments: Segment[];
  props: [PropKind, number, number, (string | null)?, number?][];
  boss: string;
  blurb: string;
  rain?: boolean;
  sprinkler?: boolean;
  slippery?: boolean;
  traffic?: boolean;
}

const g = (...types: RiderType[]): Group => ({ types });

export const STAGES: StageDef[] = [
  {
    idx: 0,
    name: '龙华城中村',
    place: '龙华 · 握手楼巷口',
    time: '08:47',
    theme: 'cv',
    music: 's1',
    length: 2700,
    blurb: '出门买个早餐，人行道已经变成赛道。',
    segments: [
      { at: 260, groups: [g('cruiser'), g('cruiser', 'cruiser')] },
      { at: 880, groups: [g('weaver', 'cruiser'), g('cruiser', 'weaver', 'cruiser')] },
      { at: 1520, groups: [g('thrower', 'cruiser'), g('weaver', 'thrower', 'cruiser')] },
    ],
    props: [
      ['crate', 360, 170, 'corn'],
      ['bin', 520, 160, 'sausage'],
      ['cone', 640, 222],
      ['bike', 760, 172, null, 0],
      ['crate', 1000, 200, 'sausage'],
      ['manhole', 1250, 205],
      ['warn', 1225, 200],
      ['crate', 1420, 168, 'tea'],
      ['bike', 1620, 225, null, 1],
      ['crate', 1700, 180, 'redpacket'],
      ['bin', 1980, 162, 'corn'],
      ['crate', 2300, 212, 'noodle'],
    ],
    boss: 'dan',
    traffic: true,
  },
  {
    idx: 1,
    name: '地铁口早高峰',
    place: '龙华站 · B出口',
    time: '08:58',
    theme: 'metro',
    music: 's2',
    length: 2900,
    blurb: '还有两分钟打卡。共享单车和秒送侠同时冲出地铁口。',
    segments: [
      { at: 240, groups: [g('cyclist', 'cyclist'), g('cruiser', 'cyclist')] },
      { at: 860, groups: [g('dasher'), g('weaver', 'cruiser', 'cyclist')] },
      { at: 1480, groups: [g('dasher', 'cruiser'), g('cyclist', 'cyclist', 'weaver')] },
      { at: 2000, groups: [g('dasher', 'dasher'), g('thrower', 'weaver')] },
    ],
    props: [
      ['bike', 330, 170, null, 0],
      ['bike', 360, 176, null, 1],
      ['crate', 560, 214, 'sausage'],
      ['cone', 700, 160],
      ['bike', 1040, 165, null, 2],
      ['crate', 1200, 190, 'noodle'],
      ['manhole', 1350, 220],
      ['warn', 1325, 215],
      ['bin', 1650, 162, 'tea'],
      ['crate', 1900, 205, 'corn'],
      ['bike', 2200, 175, null, 0],
      ['crate', 2500, 170, 'battery'],
    ],
    boss: 'fa',
    traffic: true,
  },
  {
    idx: 2,
    name: '深南大道',
    place: '深南大道 · 人行道',
    time: '12:10',
    theme: 'avenue',
    music: 's3',
    length: 3000,
    blurb: '午饭高峰，秒送侠以光速穿梭。洒水车正在唱歌。',
    sprinkler: true,
    segments: [
      { at: 260, groups: [g('dasher', 'cruiser'), g('weaver', 'weaver')] },
      { at: 900, groups: [g('dasher', 'weaver'), g('dasher', 'cruiser', 'thrower')] },
      { at: 1560, groups: [g('weaver', 'weaver', 'cruiser'), g('dasher', 'dasher', 'cruiser')] },
      { at: 2140, groups: [g('thrower', 'dasher', 'weaver')] },
    ],
    props: [
      ['cone', 400, 170],
      ['cone', 420, 176],
      ['crate', 620, 200, 'corn'],
      ['bin', 880, 160, 'sausage'],
      ['crate', 1300, 175, 'tea'],
      ['bike', 1450, 165, null, 1],
      ['crate', 1800, 215, 'noodle'],
      ['cone', 2050, 190],
      ['bin', 2300, 162, 'redpacket'],
      ['crate', 2650, 180, 'corn'],
    ],
    boss: 'feng',
    traffic: true,
  },
  {
    idx: 3,
    name: '华强北',
    place: '华强北 · 电子街',
    time: '15:30',
    theme: 'hqb',
    music: 's4',
    length: 3000,
    blurb: '魔改电驴、二手零件、无人机……这里什么都能改装。',
    segments: [
      { at: 260, groups: [g('thrower', 'weaver'), g('tank')] },
      { at: 900, groups: [g('weaver', 'cruiser', 'thrower'), g('dasher', 'tank')] },
      { at: 1560, groups: [g('tank', 'weaver'), g('thrower', 'thrower', 'dasher')] },
      { at: 2140, groups: [g('tank', 'weaver', 'cruiser')] },
    ],
    props: [
      ['crate', 420, 170, 'sausage'],
      ['crate', 445, 178, null],
      ['bin', 700, 160, 'corn'],
      ['manhole', 1000, 196],
      ['warn', 975, 191],
      ['crate', 1200, 214, 'tea'],
      ['cone', 1400, 172],
      ['crate', 1750, 200, 'noodle'],
      ['bike', 2000, 170, null, 2],
      ['crate', 2400, 180, 'redpacket'],
      ['crate', 2650, 214, 'corn'],
    ],
    boss: 'qiang',
    traffic: true,
  },
  {
    idx: 4,
    name: '科技园下班高峰',
    place: '科技园 · 写字楼下',
    time: '18:30',
    theme: 'tech',
    music: 's6',
    length: 3100,
    blurb: '外卖柜爆满，写字楼下万单齐发。速疯三轮车横冲直撞。',
    segments: [
      { at: 260, groups: [g('cruiser', 'weaver', 'cruiser'), g('tank', 'thrower')] },
      { at: 900, groups: [g('dasher', 'weaver', 'cruiser'), g('tank', 'tank')] },
      { at: 1560, groups: [g('weaver', 'weaver', 'thrower', 'cruiser'), g('dasher', 'dasher', 'tank')] },
      { at: 2240, groups: [g('cruiser', 'thrower', 'tank', 'weaver')] },
    ],
    props: [
      ['crate', 380, 214, 'sausage'],
      ['bin', 640, 160, 'tea'],
      ['cone', 820, 190],
      ['crate', 1100, 175, 'corn'],
      ['bike', 1320, 168, null, 0],
      ['crate', 1500, 205, 'noodle'],
      ['bin', 1900, 160, 'redpacket'],
      ['crate', 2100, 190, 'corn'],
      ['crate', 2550, 172, 'battery'],
      ['crate', 2780, 210, 'noodle'],
    ],
    boss: 'wang',
    traffic: true,
  },
  {
    idx: 5,
    name: '雨夜城中村',
    place: '龙华 · 雨夜',
    time: '22:15',
    theme: 'rain',
    music: 's5',
    length: 3000,
    blurb: '暴雨夜，单价加两块。路面湿滑，雨伞骑手挡住了正面。',
    rain: true,
    slippery: true,
    segments: [
      { at: 260, groups: [g('umbrella', 'cruiser'), g('umbrella', 'weaver')] },
      { at: 900, groups: [g('umbrella', 'umbrella', 'dasher'), g('thrower', 'weaver', 'umbrella')] },
      { at: 1560, groups: [g('tank', 'umbrella'), g('dasher', 'umbrella', 'umbrella')] },
      { at: 2140, groups: [g('umbrella', 'weaver', 'dasher', 'cruiser')] },
    ],
    props: [
      ['crate', 400, 175, 'corn'],
      ['manhole', 700, 210],
      ['warn', 675, 205],
      ['bin', 900, 160, 'tea'],
      ['crate', 1250, 200, 'noodle'],
      ['manhole', 1500, 180],
      ['warn', 1475, 175],
      ['crate', 1800, 214, 'sausage'],
      ['bin', 2050, 162, 'corn'],
      ['crate', 2400, 186, 'redpacket'],
      ['crate', 2700, 205, 'noodle'],
    ],
    boss: 'wei',
    traffic: true,
  },
  {
    idx: 6,
    name: '算法核心',
    place: '派单系统 · 内部',
    time: '--:--',
    theme: 'void',
    music: 'final',
    length: 1900,
    blurb: '一切的源头。骑手们的头盔亮起了红光——他们被“绑定”了。',
    segments: [
      { at: 240, groups: [g('puppet', 'puppet'), g('puppet', 'dasher', 'puppet')] },
      { at: 820, groups: [g('puppet', 'puppet', 'tank'), g('dasher', 'puppet', 'puppet')] },
    ],
    props: [
      ['crate', 420, 200, 'noodle'],
      ['crate', 700, 170, 'tea'],
      ['crate', 1050, 210, 'corn'],
      ['crate', 1300, 176, 'tea'],
      ['crate', 1350, 214, 'noodle'],
    ],
    boss: 'algo',
  },
];
