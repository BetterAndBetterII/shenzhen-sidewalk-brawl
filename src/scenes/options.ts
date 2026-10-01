// Settings menu.
import { app, Scene, toggleFullscreen } from '../app';
import { audio } from '../core/audio';
import { H, W } from '../core/gfx';
import { input } from '../core/input';
import { DIFF_DESC, DIFF_NAMES, Difficulty, persist, save } from '../core/save';
import { drawText } from '../core/text';
import { Menu, speedLines } from './ui';
import { TitleScene } from './title';

export class OptionsScene implements Scene {
  name = 'options';
  t = 0;
  menu: Menu;
  constructor() {
    const S = save.settings;
    const vol = (v: number) => '■'.repeat(Math.round(v * 10)) + '□'.repeat(10 - Math.round(v * 10));
    const apply = () => {
      audio.setVolumes(S.music, S.sfx);
      audio.setMuted(S.muted);
      app.updateOverlays();
      persist();
    };
    const cycleDiff = (d: number) => {
      S.difficulty = (((S.difficulty + d + 4) % 4) as Difficulty);
      apply();
    };
    this.menu = new Menu(
      [
        { label: () => `难度：◀ ${DIFF_NAMES[S.difficulty]} ▶`, hint: '', left: () => cycleDiff(-1), right: () => cycleDiff(1) },
        { label: () => `CRT 扫描线：${S.crt ? '开' : '关'}`, left: () => ((S.crt = !S.crt), apply()), right: () => ((S.crt = !S.crt), apply()) },
        { label: () => `屏幕震动：${S.shake ? '开' : '关'}`, left: () => ((S.shake = !S.shake), apply()), right: () => ((S.shake = !S.shake), apply()) },
        { label: () => `声音：${S.muted ? '关' : '开'}  (M键)`, left: () => ((S.muted = !S.muted), apply()), right: () => ((S.muted = !S.muted), apply()) },
        { label: () => `音乐 ${vol(S.music)}`, left: () => ((S.music = Math.max(0, Math.round((S.music - 0.1) * 10) / 10)), apply()), right: () => ((S.music = Math.min(1, Math.round((S.music + 0.1) * 10) / 10)), apply()) },
        { label: () => `音效 ${vol(S.sfx)}`, left: () => ((S.sfx = Math.max(0, Math.round((S.sfx - 0.1) * 10) / 10)), apply(), audio.sfx('hit')), right: () => ((S.sfx = Math.min(1, Math.round((S.sfx + 0.1) * 10) / 10)), apply(), audio.sfx('hit')) },
        {
          label: () => `触屏按键：${{ auto: '自动', on: '开', off: '关' }[S.touch]}`,
          left: () => ((S.touch = S.touch === 'auto' ? 'off' : S.touch === 'on' ? 'auto' : 'on'), apply()),
          right: () => ((S.touch = S.touch === 'auto' ? 'on' : S.touch === 'on' ? 'off' : 'auto'), apply()),
        },
        { label: '全屏切换 (F键)', action: () => toggleFullscreen() },
        { label: '返回', action: () => app.go(new TitleScene(true)) },
      ],
      W / 2,
      50,
      18,
      240,
    );
  }
  update() {
    this.t++;
    this.menu.update();
    if (input.pressed('back') || input.pressed('kick')) {
      audio.sfx('back');
      app.go(new TitleScene(true));
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#120a24';
    ctx.fillRect(0, 0, W, H);
    speedLines(ctx, this.t, 'rgba(120,90,200,0.15)');
    drawText(ctx, '游戏设置', W / 2, 10, { color: '#ffd040', scale: 2, align: 'center', thickOutline: true });
    this.menu.draw(ctx);
    if (this.menu.sel === 0) drawText(ctx, DIFF_DESC[save.settings.difficulty], W / 2, H - 22, { size: 12, color: '#9ad8ff', align: 'center' });
    else drawText(ctx, '←→ 调整 · J/Enter 确认 · K/Esc 返回', W / 2, H - 22, { size: 8, color: '#9ad8ff', align: 'center' });
  }
}
