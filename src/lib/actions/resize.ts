import type { Action } from 'svelte/action';

/**
 * Svelte action for a bottom-right resize grip. Resizes the closest [data-win]
 * ancestor, reporting the new width/height. Pointer-captured for smooth drags.
 */
export const resizeHandle: Action<HTMLElement, (w: number, h: number) => void> = (grip, onSize) => {
  let size = onSize;

  function down(e: PointerEvent) {
    const win = grip.closest('[data-win]') as HTMLElement | null;
    if (!win) return;
    const wr = win.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = wr.width;
    const startH = wr.height;
    grip.setPointerCapture(e.pointerId);

    function onPointerMove(ev: PointerEvent) {
      size(startW + (ev.clientX - startX), startH + (ev.clientY - startY));
    }
    function up(ev: PointerEvent) {
      grip.releasePointerCapture(ev.pointerId);
      grip.removeEventListener('pointermove', onPointerMove);
      grip.removeEventListener('pointerup', up);
    }
    grip.addEventListener('pointermove', onPointerMove);
    grip.addEventListener('pointerup', up);
    e.preventDefault();
    e.stopPropagation();
  }

  grip.addEventListener('pointerdown', down);
  return {
    update(next) {
      size = next;
    },
    destroy() {
      grip.removeEventListener('pointerdown', down);
    },
  };
};
