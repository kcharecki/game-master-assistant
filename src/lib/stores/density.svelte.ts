import { kvGet, kvSet } from '../db';

export type Density = 'compact' | 'comfortable';

/**
 * UI density preference. Drives a `data-density` attribute on the document root
 * that CSS reads to size controls; persisted like other prefs (kv).
 */
class DensityStore {
  current = $state<Density>('comfortable');
  #loaded = false;

  #apply() {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.density = this.current;
    }
  }

  set(d: Density) {
    this.current = d;
    this.#apply();
    void kvSet('density', d);
  }

  toggle() {
    this.set(this.current === 'compact' ? 'comfortable' : 'compact');
  }

  async load() {
    if (this.#loaded) return;
    this.#loaded = true;
    const s = await kvGet<Density>('density');
    if (s === 'compact' || s === 'comfortable') this.current = s;
    this.#apply();
  }
}

export const density = new DensityStore();
