import { kvGet, kvSet } from '../db';

const DEFAULT_TITLE = 'The Haunting of Blackwater Creek';

/**
 * The current session's title, shown in the topbar and editable inline.
 * Persisted to IndexedDB so it survives reloads.
 */
export const DEFAULT_SESSION_TITLE = DEFAULT_TITLE;

export class SessionStore {
  title = $state<string>(DEFAULT_TITLE);

  set(title: string): void {
    this.title = title;
    void kvSet('sessionTitle', title);
  }

  async load(): Promise<void> {
    const saved = await kvGet<string>('sessionTitle');
    if (typeof saved === 'string') this.title = saved;
  }
}

export const session = new SessionStore();
