import type { ModuleId, ModuleManifest } from './module';

/** A module's place in the ＋Widget picker: which category, which glyph. */
export interface CategoryInfo {
  category: string;
  icon: string;
}

/** Fallback for any module id not explicitly mapped below. */
export const FALLBACK: CategoryInfo = { category: 'Other', icon: '🔹' };

/**
 * id -> { category, icon }. Pure data — categories live here only, never in the
 * registry. Adding a module without updating this map is safe (it falls back to
 * 'Other'), so the picker can never crash on an unknown id.
 */
export const categoryMap: Record<ModuleId, CategoryInfo> = {
  // Combat
  initiative: { category: 'Combat', icon: '⚔️' },
  sanity: { category: 'Combat', icon: '🧠' },
  // NPCs & World
  npcs: { category: 'NPCs & World', icon: '🧑' },
  lore: { category: 'NPCs & World', icon: '📜' },
  calendar: { category: 'NPCs & World', icon: '🗓️' },
  // Maps & Broadcast
  map: { category: 'Maps & Broadcast', icon: '🗺️' },
  reveal: { category: 'Maps & Broadcast', icon: '🖼️' },
  stage: { category: 'Maps & Broadcast', icon: '🎚️' },
  preview: { category: 'Maps & Broadcast', icon: '📺' },
  handouts: { category: 'Maps & Broadcast', icon: '✉️' },
  // Atmosphere
  audio: { category: 'Atmosphere', icon: '🎵' },
  // Dice & Rules
  roller: { category: 'Dice & Rules', icon: '🎲' },
  rules: { category: 'Dice & Rules', icon: '📖' },
  // Prep & Notes
  notebook: { category: 'Prep & Notes', icon: '📝' },
  // Utility
  palette: { category: 'Utility', icon: '⌘' },
  // Timer lives with Utility — a session-pacing tool.
  timer: { category: 'Utility', icon: '⏲️' },
};

/** Stable display order of categories in the picker. */
export const CATEGORY_ORDER = [
  'Combat',
  'NPCs & World',
  'Maps & Broadcast',
  'Atmosphere',
  'Dice & Rules',
  'Prep & Notes',
  'Investigation',
  'Utility',
  FALLBACK.category,
] as const;

/** Look up a module's category + icon, falling back to 'Other' when unmapped. */
export function infoFor(id: ModuleId): CategoryInfo {
  return categoryMap[id] ?? FALLBACK;
}

export interface CategoryGroup {
  category: string;
  items: ModuleManifest[];
}

/**
 * Group modules into categories in CATEGORY_ORDER, each group's items sorted by
 * title. Empty categories are omitted. Any module whose id is missing from the
 * map lands in 'Other'.
 */
export function categorized(modules: ModuleManifest[]): CategoryGroup[] {
  const buckets = new Map<string, ModuleManifest[]>();
  for (const m of modules) {
    const { category } = infoFor(m.id);
    const bucket = buckets.get(category);
    if (bucket) bucket.push(m);
    else buckets.set(category, [m]);
  }
  const order = [...CATEGORY_ORDER];
  // Defensive: include any category not in the canonical order (shouldn't happen).
  for (const c of buckets.keys()) if (!order.includes(c as never)) order.push(c as never);

  const groups: CategoryGroup[] = [];
  for (const category of order) {
    const items = buckets.get(category);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.title.localeCompare(b.title));
    groups.push({ category, items });
  }
  return groups;
}
