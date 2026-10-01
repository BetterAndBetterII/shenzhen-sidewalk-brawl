import { app } from './app';
import { loadFonts } from './core/text';
import { audio } from './core/audio';
import { persist, save } from './core/save';
import { buildHeroSprites } from './art/hero';
import { buildProps } from './art/props';
import { setupTouch } from './touch';
import { TitleScene } from './scenes/title';
import { DEBUG, params, startGame } from './scenes/play';
import { STAGES } from './game/stages';
import { StoryScene } from './scenes/story';
import { StageSelectScene } from './scenes/select';
import { input } from './core/input';

async function boot() {
  await loadFonts();
  buildHeroSprites();
  buildProps();
  audio.muted = save.settings.muted;
  audio.setVolumes(save.settings.music, save.settings.sfx);
  app.init();
  setupTouch();
  const g = ((window as unknown as { __game: Record<string, unknown> }).__game = {
    app,
    save,
    persist,
    input,
    audio,
    stages: STAGES,
    start: (i: number) => startGame(i),
    story: (k: 'intro' | 'ending') => app.go(new StoryScene(k), true),
    select: () => app.go(new StageSelectScene(), true),
    world: null as unknown,
  });
  void g;
  const st = params.get('stage');
  if (params.has('speed')) app.speed = Math.max(1, Math.min(8, +params.get('speed')!));
  if (params.has('unlock')) {
    save.unlocked = STAGES.length - 1;
    persist();
  }
  if (st !== null) {
    app.go(new TitleScene(true), true);
    startGame(Math.max(0, Math.min(STAGES.length - 1, +st)));
  } else if (params.has('ending')) app.go(new StoryScene('ending'), true);
  else app.go(new TitleScene(DEBUG.bot), true);
  app.start();
  document.getElementById('loading')?.remove();
}
boot();
