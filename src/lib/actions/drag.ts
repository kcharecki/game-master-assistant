import type { Action } from 'svelte/action';

/**
 * Svelte action for the window title bar. Drags the closest [data-win] ancestor
 * within its offsetParent (the desktop), clamping to bounds. Reports new x/y.
 */
export const dragHandle: Action<HTMLElement, (x: number, y: number) => void> = (bar, onMove) => {
  let move = onMove;

  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    const win = bar.closest('[data-win]') as HTMLElement | null;
    const desk = win?.offsetParent as HTMLElement | null;
    if (!win || !desk) return;

    const dr = desk.getBoundingClientRect();
    const wr = win.getBoundingClientRect();
    const ox = e.clientX - wr.left;
    const oy = e.clientY - wr.top;
    bar.setPointerCapture(e.pointerId);

    function onPointerMove(ev: PointerEvent) {
      const x = Math.max(0, Math.min(ev.clientX - dr.left - ox, desk!.clientWidth - win!.offsetWidth));
      const y = Math.max(0, Math.min(ev.clientY - dr.top - oy, desk!.clientHeight - win!.offsetHeight));
      move(x, y);
    }
    function up(ev: PointerEvent) {
      bar.releasePointerCapture(ev.pointerId);
      bar.removeEventListener('pointermove', onPointerMove);
      bar.removeEventListener('pointerup', up);
    }
    bar.addEventListener('pointermove', onPointerMove);
    bar.addEventListener('pointerup', up);
    e.preventDefault();
  }

  bar.addEventListener('pointerdown', down);
  return {
    update(next) {
      move = next;
    },
    destroy() {
      bar.removeEventListener('pointerdown', down);
    },
  };
};
