import type { WindowState, WindowKind } from './types';
import type { GameSystem } from './system';
import { kvGet, kvSet } from './db';

/** One saved window placement — module kind + geometry, no runtime ids/z. */
export interface LayoutWindow {
  kind: WindowKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A named arrangement of windows the GM can restore on demand. */
export interface LayoutPreset {
  name: string;
  windows: LayoutWindow[];
}

const KEY_PREFIX = 'layoutPresets:';

function key(system: GameSystem): string {
  return `${KEY_PREFIX}${system}`;
}

/**
 * Serialize the live windows into a named preset, dropping volatile fields
 * (id, z, minimized). Pure — unit-tested, no DOM.
 */
export function serializeLayout(name: string, windows: WindowState[]): LayoutPreset {
  return {
    name,
    windows: windows.map((w) => ({ kind: w.kind, x: w.x, y: w.y, w: w.w, h: w.h })),
  };
}

/**
 * Insert or replace a preset by name in a preset list (case-insensitive match).
 * Returns a new array; original is untouched. Pure.
 */
export function upsertPreset(presets: LayoutPreset[], preset: LayoutPreset): LayoutPreset[] {
  const i = presets.findIndex((p) => p.name.toLowerCase() === preset.name.toLowerCase());
  if (i === -1) return [...presets, preset];
  const next = presets.slice();
  next[i] = preset;
  return next;
}

/** Find a preset by name (case-insensitive). Pure. */
export function findPreset(presets: LayoutPreset[], name: string): LayoutPreset | undefined {
  const key = name.trim().toLowerCase();
  return presets.find((p) => p.name.toLowerCase() === key);
}

/** Remove a preset by name (case-insensitive). Returns a new array. Pure. */
export function removePreset(presets: LayoutPreset[], name: string): LayoutPreset[] {
  const key = name.trim().toLowerCase();
  return presets.filter((p) => p.name.toLowerCase() !== key);
}

/** Load the saved presets for a system from kv. */
export async function loadPresets(system: GameSystem): Promise<LayoutPreset[]> {
  return (await kvGet<LayoutPreset[]>(key(system))) ?? [];
}

/** Persist the preset list for a system to kv. */
export async function savePresets(system: GameSystem, presets: LayoutPreset[]): Promise<void> {
  await kvSet(key(system), presets);
}
