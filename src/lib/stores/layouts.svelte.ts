import { wm } from './windows.svelte';
import { system } from './system.svelte';
import {
  serializeLayout,
  upsertPreset,
  findPreset,
  removePreset,
  loadPresets,
  savePresets,
  type LayoutPreset,
} from '../layouts';

/**
 * Reactive layout-preset manager. Presets are keyed by the active game system
 * so D&D combat layouts and CoC investigation layouts stay separate.
 */
class LayoutStore {
  presets = $state<LayoutPreset[]>([]);

  /** Reload presets for the current system (call on mount / system change). */
  async load(): Promise<void> {
    this.presets = await loadPresets(system.current);
  }

  /** Capture the current window arrangement under a name. */
  async save(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = serializeLayout(trimmed, $state.snapshot(wm.windows));
    this.presets = upsertPreset($state.snapshot(this.presets), preset);
    await savePresets(system.current, $state.snapshot(this.presets));
  }

  /** Restore a named preset onto the desktop (replaces current windows). */
  restore(name: string): void {
    const preset = findPreset($state.snapshot(this.presets), name);
    if (preset) wm.restore(preset.windows);
  }

  async remove(name: string): Promise<void> {
    this.presets = removePreset($state.snapshot(this.presets), name);
    await savePresets(system.current, $state.snapshot(this.presets));
  }
}

export const layouts = new LayoutStore();
