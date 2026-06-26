import type { ModuleId } from './module';

/** The two game systems the app adapts to. */
export type GameSystem = 'dnd5e' | 'coc7e';

/** Default dice mode a system rolls in: d20 (D&D) or d100 (Call of Cthulhu). */
export type DiceMode = 'd20' | 'd100';

export interface SystemConfig {
  id: GameSystem;
  label: string;
  /** which die the roller / skill-check helper defaults to */
  diceMode: DiceMode;
  /** modules that are most relevant for this system (used to surface widgets) */
  relevantModules: ModuleId[];
}

const CONFIGS: Record<GameSystem, SystemConfig> = {
  dnd5e: {
    id: 'dnd5e',
    label: 'D&D 5e',
    diceMode: 'd20',
    relevantModules: ['statblock', 'encounter', 'initiative'],
  },
  coc7e: {
    id: 'coc7e',
    label: 'CoC 7e',
    diceMode: 'd100',
    relevantModules: ['sanity', 'clues'],
  },
};

export const SYSTEMS: GameSystem[] = ['dnd5e', 'coc7e'];

/** Pure selector: resolve the config for a system. */
export function systemConfig(system: GameSystem): SystemConfig {
  return CONFIGS[system];
}

/** Is a module considered system-specific (relevant only to one system)? */
export function isRelevantTo(module: ModuleId, system: GameSystem): boolean {
  return CONFIGS[system].relevantModules.includes(module);
}
