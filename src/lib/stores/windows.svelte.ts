import type { WindowState, WindowKind } from '../types';
import { kvGet, kvSet } from '../db';
import { getModule } from '../registry';

/** kv key: last size (w/h) the GM left a module's window at, keyed by module id. */
const SIZES_KEY = 'windowSizes';

type SizeMap = Partial<Record<WindowKind, { w: number; h: number }>>;

/** Reactive desktop window manager. One instance shared across the GM app. */
class WindowManager {
  static readonly MIN_W = 200;
  static readonly MIN_H = 120;

  windows = $state<WindowState[]>([]);
  #z = 10;
  /** per-module remembered size, so a new window opens where the last one sat. */
  #sizes: SizeMap = {};

  add(kind: WindowKind, x = 40, y = 40): WindowState {
    const mod = getModule(kind);
    const remembered = this.#sizes[kind];
    const win: WindowState = {
      id: crypto.randomUUID(),
      kind,
      title: mod.title,
      x,
      y,
      w: remembered?.w ?? mod.size.w,
      h: remembered?.h ?? mod.size.h,
      z: ++this.#z,
      minimized: false,
      collapsed: false,
    };
    this.windows.push(win);
    this.persist();
    return win;
  }

  /**
   * macOS-dock behaviour: at most one window per module. Spawn if none exists;
   * minimize a visible one; restore + raise a minimized one.
   */
  toggle(kind: WindowKind, x = 40, y = 40): void {
    const win = this.windows.find((w) => w.kind === kind);
    if (!win) {
      this.add(kind, x, y);
      return;
    }
    if (win.minimized) {
      win.minimized = false;
      win.z = ++this.#z;
    } else {
      win.minimized = true;
    }
    this.persist();
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

  /**
   * Resize a window, clamping to sane minimums. Does NOT persist — used during a
   * live resize drag (call `commitResize` once on release to persist).
   */
  resize(id: string, w: number, h: number): void {
    const win = this.windows.find((win) => win.id === id);
    if (!win) return;
    win.w = Math.max(WindowManager.MIN_W, Math.round(w));
    win.h = Math.max(WindowManager.MIN_H, Math.round(h));
  }

  /** Persist the final size once a resize drag ends (remembers it per module). */
  commitResize(id: string, w: number, h: number): void {
    this.resize(id, w, h);
    const win = this.windows.find((win) => win.id === id);
    if (!win) return;
    this.#sizes[win.kind] = { w: win.w, h: win.h };
    void kvSet(SIZES_KEY, this.#sizes);
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
    // Drop placements for modules that no longer exist (removed features).
    this.windows = layout
      .filter((p) => getModule(p.kind))
      .map((p) => ({
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
    const sizes = await kvGet<SizeMap>(SIZES_KEY);
    if (sizes) {
      this.#sizes = sizes;
      // Drop remembered sizes for modules that no longer exist, so a reused id
      // can't silently inherit a removed feature's geometry.
      let pruned = false;
      for (const kind of Object.keys(this.#sizes) as WindowKind[]) {
        if (!getModule(kind)) {
          delete this.#sizes[kind];
          pruned = true;
        }
      }
      if (pruned) void kvSet(SIZES_KEY, this.#sizes);
    }
    const saved = await kvGet<WindowState[]>('windows');
    if (saved?.length) {
      // Drop windows for removed modules; older saves predate `collapsed`.
      const live = saved.filter((w) => getModule(w.kind));
      this.windows = live.map((w) => ({ ...w, collapsed: w.collapsed ?? false }));
      this.#z = Math.max(...live.map((w) => w.z), 10);
    }
  }
}

export const wm = new WindowManager();
