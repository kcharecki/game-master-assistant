import type { GameSystem } from '../../lib/system';

/** A token state/condition: stable id, display label, compact glyph. */
export interface TokenCondition {
  id: string;
  label: string;
  glyph: string;
}

/**
 * System-specific states a battle-map token can carry. D&D 5e conditions and
 * Call of Cthulhu 7e states. Kept tiny (one glyph each) so many fit per token.
 */
export const TOKEN_CONDITIONS: Record<GameSystem, TokenCondition[]> = {
  dnd5e: [
    { id: 'blinded', label: 'Blinded', glyph: '🙈' },
    { id: 'charmed', label: 'Charmed', glyph: '💖' },
    { id: 'deafened', label: 'Deafened', glyph: '🔇' },
    { id: 'exhaustion', label: 'Exhaustion', glyph: '😩' },
    { id: 'frightened', label: 'Frightened', glyph: '😱' },
    { id: 'grappled', label: 'Grappled', glyph: '🤼' },
    { id: 'incapacitated', label: 'Incapacitated', glyph: '💫' },
    { id: 'invisible', label: 'Invisible', glyph: '👻' },
    { id: 'paralyzed', label: 'Paralyzed', glyph: '⛓️' },
    { id: 'petrified', label: 'Petrified', glyph: '🗿' },
    { id: 'poisoned', label: 'Poisoned', glyph: '🤢' },
    { id: 'prone', label: 'Prone', glyph: '⬇️' },
    { id: 'restrained', label: 'Restrained', glyph: '🕸️' },
    { id: 'stunned', label: 'Stunned', glyph: '🌀' },
    { id: 'unconscious', label: 'Unconscious', glyph: '💤' },
  ],
  coc7e: [
    { id: 'temp-insanity', label: 'Temporary Insanity', glyph: '🌀' },
    { id: 'indef-insanity', label: 'Indefinite Insanity', glyph: '🌑' },
    { id: 'bout-of-madness', label: 'Bout of Madness', glyph: '😵' },
    { id: 'phobia', label: 'Phobia', glyph: '😨' },
    { id: 'mania', label: 'Mania', glyph: '🤪' },
    { id: 'major-wound', label: 'Major Wound', glyph: '🩸' },
    { id: 'dying', label: 'Dying', glyph: '🆘' },
    { id: 'unconscious', label: 'Unconscious', glyph: '💤' },
    { id: 'dead', label: 'Dead', glyph: '💀' },
    { id: 'prone', label: 'Prone', glyph: '⬇️' },
    { id: 'surprised', label: 'Surprised', glyph: '❗' },
    { id: 'pursued', label: 'Pursued', glyph: '🏃' },
    { id: 'pushed', label: 'Pushed roll', glyph: '🎲' },
  ],
};

/** The condition catalog for a system. */
export function conditionsFor(system: GameSystem): TokenCondition[] {
  return TOKEN_CONDITIONS[system];
}

/** Resolve a condition id to its catalog entry (search both systems). */
export function conditionMeta(id: string): TokenCondition | undefined {
  for (const list of Object.values(TOKEN_CONDITIONS)) {
    const found = list.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Glyph for a condition id (falls back to a dot). */
export function conditionGlyph(id: string): string {
  return conditionMeta(id)?.glyph ?? '•';
}
