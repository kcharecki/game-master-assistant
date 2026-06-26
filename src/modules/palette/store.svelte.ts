import { wm } from '../../lib/stores/windows.svelte';
import { search, type PaletteHit, type PaletteItem } from './search';
import { collectSources } from './sources';

/**
 * Command palette overlay state. Opened by a global Ctrl/Cmd+K (wired in
 * App.svelte). Indexes the app's stores on open and runs the selected result.
 */
class PaletteStore {
  open = $state(false);
  query = $state('');
  selected = $state(0);
  #sources: PaletteItem[] = [];

  /** Callback into App.svelte to open an editor tab (set once on mount). */
  onOpenEditor: ((id: PaletteItem['module']) => void) | null = null;

  get results(): PaletteHit[] {
    return search(this.query, this.#sources);
  }

  show(): void {
    this.#sources = collectSources();
    this.query = '';
    this.selected = 0;
    this.open = true;
  }

  hide(): void {
    this.open = false;
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  setQuery(q: string): void {
    this.query = q;
    this.selected = 0;
  }

  /** Move the highlight by delta, clamped to the results range. */
  moveSelection(delta: number): void {
    const n = this.results.length;
    if (n === 0) return;
    this.selected = (this.selected + delta + n) % n;
  }

  /** Run the currently highlighted result (or one passed explicitly). */
  run(hit?: PaletteHit): void {
    const target = hit ?? this.results[this.selected];
    if (!target) return;
    if (target.kind === 'editor') {
      this.onOpenEditor?.(target.module);
    } else {
      // 'open' and 'spawn' both surface a desktop window for the module.
      wm.add(target.module, 120, 120);
    }
    this.hide();
  }
}

export const palette = new PaletteStore();
