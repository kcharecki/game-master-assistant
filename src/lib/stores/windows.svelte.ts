import type { WindowState, WindowKind } from '../types';
import { kvGet, kvSet } from '../db';
import { getModule } from '../registry';

/** Reactive desktop window manager. One instance shared across the GM app. */
class WindowManager {
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

  toggleMin(id: string): void {
    const w = this.windows.find((w) => w.id === id);
    if (w) w.minimized = !w.minimized;
    this.persist();
  }

  close(id: string): void {
    this.windows = this.windows.filter((w) => w.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('windows', $state.snapshot(this.windows));
  }

  async load(): Promise<void> {
    const saved = await kvGet<WindowState[]>('windows');
    if (saved?.length) {
      this.windows = saved;
      this.#z = Math.max(...saved.map((w) => w.z), 10);
    }
  }
}

export const wm = new WindowManager();
