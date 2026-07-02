/**
 * Mood / lighting presets (#19): a purely presentational color wash the GM
 * pushes to the broadcast page. Like display mode, it never carries GM-private
 * data and is mirrored to its own kv key.
 */
export interface Mood {
  id: string;
  label: string;
  /** rgb tint applied as an overlay, e.g. "12,30,20" */
  tint: string;
  /** overlay opacity 0..1 */
  intensity: number;
  /** css brightness multiplier applied to the content, e.g. 0.8 */
  brightness: number;
  /** vignette darkness 0..1 (0 = none) */
  vignette: number;
}

export const MOOD_KEY = 'broadcastMood';

export const MOODS: Mood[] = [
  { id: 'neutral', label: 'Neutral', tint: '0,0,0', intensity: 0, brightness: 1, vignette: 0 },
  { id: 'dread', label: 'Dread', tint: '8,20,14', intensity: 0.42, brightness: 0.78, vignette: 0.55 },
  { id: 'warm', label: 'Hearth', tint: '60,30,8', intensity: 0.3, brightness: 1.05, vignette: 0.2 },
  { id: 'cold', label: 'Cold', tint: '14,28,48', intensity: 0.34, brightness: 0.9, vignette: 0.3 },
  { id: 'blood', label: 'Blood', tint: '60,6,6', intensity: 0.4, brightness: 0.85, vignette: 0.45 },
];

export const DEFAULT_MOOD: Mood = MOODS[0];

/** Find a mood by id, falling back to the default. Pure. */
export function moodById(id: string): Mood {
  return MOODS.find((m) => m.id === id) ?? DEFAULT_MOOD;
}

/** Narrow an unknown (rehydrated) value to a valid Mood. Pure. */
export function normalizeMood(value: unknown): Mood {
  if (value && typeof value === 'object' && 'id' in value) {
    return moodById(String((value as { id: unknown }).id));
  }
  return DEFAULT_MOOD;
}

/**
 * Build the CSS the broadcast page applies for a mood: an overlay color and
 * a content filter. Returned as plain strings so the component just binds them.
 * Pure — unit-tested, no DOM.
 */
export function moodStyle(mood: Mood): { overlay: string; filter: string } {
  const overlay =
    mood.intensity <= 0 && mood.vignette <= 0
      ? 'transparent'
      : `radial-gradient(140% 110% at 50% 45%, rgba(${mood.tint},${mood.intensity}) 0%, rgba(0,0,0,${mood.vignette}) 100%)`;
  return { overlay, filter: `brightness(${mood.brightness})` };
}

/**
 * Cinematic film-grain overlay style for a mood: a translucent tint (the mood's
 * colour, scaled down so the grain reads as a wash not a fill) plus a small grain
 * opacity that rises with the mood's intensity. Pure — unit-tested, no DOM.
 * Returns CSS-ready strings the broadcast page binds directly.
 */
export function grainStyle(mood: Mood): { tint: string; opacity: number } {
  // Neutral mood: faint colourless grain. Others: tinted, a touch stronger.
  const opacity = Math.round((0.06 + mood.intensity * 0.1) * 1000) / 1000;
  const tintAlpha = Math.round(mood.intensity * 0.35 * 1000) / 1000;
  const tint = mood.intensity <= 0 ? 'transparent' : `rgba(${mood.tint},${tintAlpha})`;
  return { tint, opacity };
}
