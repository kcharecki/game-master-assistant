import type { WindowState, WindowKind } from '../types';
import { kvGet, kvSet } from '../db';
import { getModule } from '../registry';

/** Reactive desktop window manager. One instance shared across the GM app. */
class WindowManager {
  static readonly MIN_W = 200;
  static readonly MIN_H = 120;

  windows = $state<WindowState[]>([]);
  #z = 10;

  add(kind: WindowKind, x = 40, y = 40): WindowState {
    const mod = getModule(kind);
    const win: WindowState = {
      id: crypto.randomUUID(),
      kind,
      title: mod.title,
      x,
      y,
      w: mod.size.w,
      h: mod.size.h,
      z: ++this.#z,
      minimized: false,
      collapsed: false,
    };
    this.windows.push(win);
    this.persist();
    return win;
  }

  focus(id: string): void {
    const w = this.windows.find((w) => w.id === id);
    if (w) w.z = ++this.#z;
  }

  move(id: string, x: number, y: number): void {
    const w = this.windows.find((w) => w.id === id);
    if (w) {
      w.x = x;
      w.y = y;
    }
  }

  /** Resize a window, clamping to sane minimums. */
  resize(id: string, w: number, h: number): void {
    const win = this.windows.find((win) => win.id === id);
    if (!win) return;
    win.w = Math.max(WindowManager.MIN_W, Math.round(w));
    win.h = Math.max(WindowManager.MIN_H, Math.round(h));
    this.persist();
  }

  toggleMin(id: string): void {
    const w = this.windows.find((w) => w.id === id);
    if (w) w.minimized = !w.minimized;
    this.persist();
  }

  /** Roll the window up to its title bar (content hidden) without moving it. */
  toggleCollapse(id: string): void {
    const w = this.windows.find((w) => w.id === id);
    if (w) w.collapsed = !w.collapsed;
    this.persist();
  }

  close(id: string): void {
    this.windows = this.windows.filter((w) => w.id !== id);
    this.persist();
  }

  /**
   * Auto-arrange every visible (non-minimized) window into a non-overlapping
   * grid that fills the given viewport. Collapsed windows still get a cell.
   * Viewport dims are passed in so this is unit-testable without the DOM.
   */
  tile(viewportW: number, viewportH: number, gap = 12, pad = 12): void {
    const visible = this.windows.filter((w) => !w.minimized);
    const n = visible.length;
    if (n === 0) return;

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = (viewportW - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (viewportH - pad * 2 - gap * (rows - 1)) / rows;

    visible.forEach((win, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      win.x = Math.round(pad + col * (cellW + gap));
      win.y = Math.round(pad + row * (cellH + gap));
      win.w = Math.max(WindowManager.MIN_W, Math.round(cellW));
      win.h = Math.max(WindowManager.MIN_H, Math.round(cellH));
    });

    this.persist();
  }

  /** Remove every window. */
  clear(): void {
    this.windows = [];
    this.persist();
  }

  /**
   * Replace all windows with a saved layout: clear, then re-add each placement
   * at its saved geometry. New ids/z are minted so windows stay interactive.
   */
  restore(layout: { kind: WindowKind; x: number; y: number; w: number; h: number }[]): void {
    this.windows = layout.map((p) => ({
      id: crypto.randomUUID(),
      kind: p.kind,
      title: getModule(p.kind).title,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      z: ++this.#z,
      minimized: false,
      collapsed: false,
    }));
    this.persist();
  }

  persist(): void {
    void kvSet('windows', $state.snapshot(this.windows));
  }

  async load(): Promise<void> {
    const saved = await kvGet<WindowState[]>('windows');
    if (saved?.length) {
      // Older saved windows predate `collapsed`; coerce missing to false.
      this.windows = saved.map((w) => ({ ...w, collapsed: w.collapsed ?? false }));
      this.#z = Math.max(...saved.map((w) => w.z), 10);
    }
  }
}

export const wm = new WindowManager();
