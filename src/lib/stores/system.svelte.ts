import { kvGet, kvSet } from '../db';
import { type GameSystem, type SystemConfig, systemConfig, SYSTEMS } from '../system';

/**
 * The active game system, shared across modules. System-specific widgets and
 * the dice mode read from here reactively; switching adapts the whole app.
 */
class SystemStore {
  current = $state<GameSystem>('coc7e');

  get config(): SystemConfig {
    return systemConfig(this.current);
  }

  set(system: GameSystem): void {
    this.current = system;
    this.persist();
  }

  /** Flip to the other system (two-system toggle). */
  toggle(): void {
    const next = SYSTEMS.find((s) => s !== this.current) ?? this.current;
    this.set(next);
  }

  persist(): void {
    void kvSet('system', this.current);
  }

  async load(): Promise<void> {
    const saved = await kvGet<GameSystem>('system');
    if (saved === 'dnd5e' || saved === 'coc7e') this.current = saved;
  }
}

export const system = new SystemStore();
