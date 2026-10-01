# 深圳人行道角斗场 · Shenzhen Sidewalk Brawl

> **是算法的问题，不是他们的错！**

一款 16-bit 像素风街机横版清版闯关（beat 'em up）网页游戏。
早上 8:47 的龙华，阿龙只想走路去上班——可人行道早已变成外卖电驴的赛道。
用拳头让飞驰的骑手们**慢下来**，一路打到幕后的「派单算法 ALGO-9000」，把骑手们从系统里解放出来。

**▶ 在线游玩：<https://brawl.po.uy>**（备用：<https://shenzhen-sidewalk-brawl.pages.dev>）

无需安装，桌面浏览器 / 手机横屏均可，支持键盘、手柄与触屏。

## 玩法特色

- **7 个关卡，一天的深圳**：龙华城中村 → 地铁口早高峰 → 深南大道（会唱歌的洒水车）→ 华强北（魔改电驴、无人机）→ 科技园下班高峰 → 雨夜城中村（湿滑路面、雷电）→ 算法核心。
- **街机格斗手感**：拳三连击、腿、跳跃空中攻击、奔跑飞踢、翻滚闪避（**完美闪避**触发子弹时间）、J+K 旋风腿、抓住眩晕的骑手膝撞 / 过肩摔、举起共享单车和木箱扔出去。
- **蓝色能量拳**：气槽分 3 格。点按「气」= 能量直拳；长按蓄力 = 龙华波动拳 / 真·波动拳；满 3 格长按 = 全屏超必杀「人行道正义拳」。
- **多种骑手**：普通巡航、左右摆尾的蛇形骑手、扔包裹/白菜的、引擎轰鸣后直线冲刺的「秒送侠」、皮糙肉厚的三轮快运、打伞格挡正面的雨夜骑手、被算法「绑定」的傀儡骑手……迎面冲来时出拳可打出 **COUNTER**。
- **不血腥**：被打败的骑手会摔个跟头、坐地上冒星星、说句心里话，然后慢慢地骑走——「平稳送达」。
- **7 个 Boss**：单王黄哥、摩的佬发哥、秒送侠疾风、魔改王强哥、配送站长王经理、雨夜骑士阿伟，以及最终 Boss——会故障、会发射「预计送达」激光、会扫描全屏的派单算法。
- **街机味儿拉满**：INSERT COIN、CONTINUE 倒计时、续币、限时、连击、关卡评级（S/A/B/C/D）、最高分；顿帧、震屏、像素粒子、速度线、打击火花、可选 CRT 扫描线。
- **原创芯片音乐 & 音效**：全部由 WebAudio 实时合成，按 `M` 静音。
- **进度保存**：最高分、已解锁关卡、每关最佳评级与分数存于 localStorage；可在「选择关卡」重玩，4 档难度（简单 / 普通 / 困难 / 地狱）。
- **全部美术均为程序化原创像素画**，平台名称（吃了没、跑腿兔、绿叶鲜生、秒送侠、速疯快运……）纯属虚构。

## 操作

| 动作 | 键盘 | 手柄 | 触屏 |
| --- | --- | --- | --- |
| 移动 | 方向键 / WASD | 左摇杆 / 十字键 | 左侧虚拟摇杆 |
| 奔跑 | 双击 ← / → | 双击方向 | 快速推两下 |
| 拳（3 段连击） | J / Z | X | 拳 |
| 腿 | K / X | Y | 腿 |
| 跳（空中可拳/腿） | L / Space / C | A | 跳 |
| 翻滚闪避 | U / Shift | B / LB | 闪 |
| 能量拳 / 长按蓄力 | I / V | RB / RT | 气 |
| 旋风腿 | J + K | X + Y | — |
| 抓住眩晕骑手 → 摔 | 靠近按 J，再按 K | — | — |
| 暂停 / 静音 / 全屏 | Enter·Esc / M / F | Start | II |

手机请横屏游玩（竖屏会有提示）。

## 技术

- **Vite + TypeScript**，零运行时依赖，纯 Canvas 2D。
- 内部分辨率 480×270，整数倍最近邻放大，像素锐利。
- 所有角色、载具、街景、道具在启动时用代码绘制成精灵（`src/art/`）。
- 音乐与音效：WebAudio 合成器 + 简易音序器（`src/core/audio.ts`、`src/core/music.ts`）。
- 像素字体：[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)（OFL-1.1），按游戏实际用字子集化，仅约 40 KB。
- 部署：Cloudflare Pages（`npm ci && npm run build`，输出 `dist/`）。

```
src/
  app.ts            场景管理、固定步长主循环、画面缩放
  core/             图形、像素文字、输入（键盘/手柄/触屏）、音频、存档
  art/              程序化像素美术：主角、骑手、背景、道具
  game/             战斗世界、玩家、敌人、Boss、关卡、HUD、特效
  scenes/           标题、剧情、关卡选择、游戏、结算、设置、说明
```

## 开发

```bash
npm install
npm run dev       # 本地开发 http://localhost:5173
npm run build     # 类型检查 + 生产构建到 dist/
npm run preview   # 预览生产构建
npm run font      # （可选）重新子集化像素字体，需要 uvx + fonttools；源字体放在 fonts-src/
```

调试参数：`?stage=0..6` 直接进入关卡，`?unlock` 解锁全部关卡，`?bot` 自动战斗，`?god` 无敌，`?speed=4` 加速，`?ending` 查看结局。

---

## English

**Shenzhen Sidewalk Brawl** is a retro 16-bit pixel-art belt-scroller beat 'em up that runs in the browser.
In Longhua, Shenzhen, the sidewalk has become a race track for delivery e-scooters. Punch, kick, roll, grab and charge your glowing blue energy fist to make the riders *slow down* — then take on the real villain, the dispatch algorithm. *"It's the algorithm's fault, not theirs!"*

- Play: **<https://brawl.po.uy>**
- 7 stages, 7 bosses, combos, counters, perfect dodges, throws, throwable props, a 3-level super meter, continues, ranks, high scores and stage select saved in localStorage, 4 difficulty levels.
- Keyboard (arrows/WASD + J/K/L/U/I), gamepad, and mobile touch controls (landscape).
- Vite + TypeScript + Canvas 2D; all art procedurally drawn, all music/SFX synthesized with WebAudio. Platform names are fictional parodies.

```bash
npm install && npm run dev
```

The bundled pixel font is licensed under OFL-1.1 (`src/assets/fonts/OFL.txt`). All other art, music and code are original to this project.
