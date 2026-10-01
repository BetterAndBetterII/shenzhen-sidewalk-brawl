// Virtual joystick + buttons for touch devices.
import { Btn, input } from './core/input';

export function setupTouch() {
  const zone = document.getElementById('stick-zone')!;
  const base = document.getElementById('stick-base')!;
  const knob = document.getElementById('stick-knob')!;
  let stickId: number | null = null;
  let cx = 0;
  let cy = 0;
  const setDir = (dx: number, dy: number) => {
    const dead = 0.28;
    input.touch.left = dx < -dead;
    input.touch.right = dx > dead;
    input.touch.up = dy < -dead;
    input.touch.down = dy > dead;
  };
  const center = () => {
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
  };
  const move = (x: number, y: number) => {
    const r = base.getBoundingClientRect();
    const rad = r.width / 2;
    let dx = (x - cx) / rad;
    let dy = (y - cy) / rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    knob.style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
    setDir(dx, dy);
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.lastDevice = 'touch';
    input.gesture();
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    // floating stick: recenter the base under the thumb
    const zr = zone.getBoundingClientRect();
    const br = base.getBoundingClientRect();
    const lx = Math.max(4, Math.min(zr.width - br.width - 4, e.clientX - zr.left - br.width / 2));
    const by = Math.max(4, Math.min(zr.height - br.height - 4, zr.bottom - e.clientY - br.height / 2));
    base.style.left = lx + 'px';
    base.style.bottom = by + 'px';
    center();
    move(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    move(e.clientX, e.clientY);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    knob.style.transform = '';
    base.style.left = '';
    base.style.bottom = '';
    setDir(0, 0);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  document.querySelectorAll<HTMLButtonElement>('.tb').forEach((el) => {
    const b = el.dataset.b as Btn;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      input.lastDevice = 'touch';
      input.gesture();
      el.setPointerCapture(e.pointerId);
      input.touch[b] = true;
      el.classList.add('on');
      if (navigator.vibrate) navigator.vibrate(8);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      input.touch[b] = false;
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
