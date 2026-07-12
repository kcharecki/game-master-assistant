import { kvGet, kvSet } from '../db';

const DEFAULT_TITLE = 'The Haunting of Blackwater Creek';

/**
 * The current session's title, shown in the topbar and editable inline.
 * Persisted to IndexedDB so it survives reloads.
 */
export const DEFAULT_SESSION_TITLE = DEFAULT_TITLE;

export class SessionStore {
  title = $state<string>(DEFAULT_TITLE);
  /** When the current session clock started (epoch ms). Persisted so it survives reload. */
  startedAt = $state<number>(Date.now());

  set(title: string): void {
    this.title = title;
    void kvSet('sessionTitle', title);
  }

  async load(): Promise<void> {
    const saved = await kvGet<string>('sessionTitle');
    if (typeof saved === 'string') this.title = saved;

    const savedStart = await kvGet<number>('sessionStartedAt');
    if (typeof savedStart === 'number') {
      this.startedAt = savedStart;
    } else {
      void kvSet('sessionStartedAt', this.startedAt);
    }
  }
}

export const session = new SessionStore();
