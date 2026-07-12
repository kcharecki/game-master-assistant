import type { Action } from 'svelte/action';

export interface ResizeOpts {
  /** Per-frame size update — reactive, must NOT persist. */
  resize: (w: number, h: number) => void;
  /** Final size — called once on release; persists. */
  commit: (w: number, h: number) => void;
}

/**
 * Bottom-right resize grip for the closest [data-win] ancestor. Size updates
 * are rAF-throttled and flow through `resize` (reactive, no persist); the final
 * size is persisted once on release via `commit` — mirrors the drag handler so
 * a resize drag doesn't fire an IndexedDB write per pointermove.
 */
export const resizeHandle: Action<HTMLElement, ResizeOpts> = (grip, opts) => {
  let o = opts;

  function down(e: PointerEvent) {
    const win = grip.closest('[data-win]') as HTMLElement | null;
    if (!win) return;
    const wr = win.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = wr.width;
    const startH = wr.height;
    grip.setPointerCapture(e.pointerId);

    let raf = 0;
    let last = { w: startW, h: startH };
    let pending: { cx: number; cy: number } | null = null;

    function apply() {
      raf = 0;
      if (!pending) return;
      last = { w: startW + (pending.cx - startX), h: startH + (pending.cy - startY) };
      o.resize(last.w, last.h);
    }
    function onPointerMove(ev: PointerEvent) {
      pending = { cx: ev.clientX, cy: ev.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function up(ev: PointerEvent) {
      if (raf) cancelAnimationFrame(raf);
      grip.releasePointerCapture(ev.pointerId);
      grip.removeEventListener('pointermove', onPointerMove);
      grip.removeEventListener('pointerup', up);
      o.commit(last.w, last.h);
    }
    grip.addEventListener('pointermove', onPointerMove);
    grip.addEventListener('pointerup', up);
    e.preventDefault();
    e.stopPropagation();
  }

  grip.addEventListener('pointerdown', down);
  return {
    update(next) {
      o = next;
    },
    destroy() {
      grip.removeEventListener('pointerdown', down);
    },
  };
};
