import type { Action } from 'svelte/action';

export interface DragOpts {
  /** Map a raw desktop-space x/y to a (possibly snapped) x/y. No state write. */
  snap: (x: number, y: number) => { x: number; y: number };
  /** Commit the final position to state — called once, on release. */
  commit: (x: number, y: number) => void;
}

/**
 * Window title-bar drag. During the drag it writes `transform` straight to the
 * dragged [data-win] element (rAF-throttled, no reactivity), then commits the
 * final snapped position to the store once on pointerup.
 */
export const dragHandle: Action<HTMLElement, DragOpts> = (bar, opts) => {
  let o = opts;

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
    win.classList.add('dragging');

    let raf = 0;
    let last = { x: wr.left - dr.left, y: wr.top - dr.top };
    let pending: { cx: number; cy: number } | null = null;

    function apply() {
      raf = 0;
      if (!pending) return;
      const rawX = Math.max(0, Math.min(pending.cx - dr.left - ox, desk!.clientWidth - win!.offsetWidth));
      const rawY = Math.max(0, Math.min(pending.cy - dr.top - oy, desk!.clientHeight - win!.offsetHeight));
      const s = o.snap(rawX, rawY);
      last = s;
      win!.style.transform = `translate3d(${s.x}px,${s.y}px,0)`;
    }

    function onPointerMove(ev: PointerEvent) {
      pending = { cx: ev.clientX, cy: ev.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function up(ev: PointerEvent) {
      if (raf) cancelAnimationFrame(raf);
      bar.releasePointerCapture(ev.pointerId);
      bar.removeEventListener('pointermove', onPointerMove);
      bar.removeEventListener('pointerup', up);
      win!.classList.remove('dragging');
      o.commit(last.x, last.y);
    }
    bar.addEventListener('pointermove', onPointerMove);
    bar.addEventListener('pointerup', up);
    e.preventDefault();
  }

  bar.addEventListener('pointerdown', down);
  return {
    update(next) { o = next; },
    destroy() { bar.removeEventListener('pointerdown', down); },
  };
};
