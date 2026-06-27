import { kvGet, kvSet } from '../db';

export type Locale = 'en' | 'pl';

class LangStore {
  current = $state<Locale>('en');
  #loaded = false;

  set(l: Locale) {
    this.current = l;
    void kvSet('lang', l);
  }

  async load() {
    if (this.#loaded) return;
    this.#loaded = true;
    const s = await kvGet<Locale>('lang');
    if (s === 'en' || s === 'pl') this.current = s;
  }
}

export const lang = new LangStore();
