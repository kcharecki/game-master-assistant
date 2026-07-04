import type { Component } from 'svelte';

/** Every feature/module is identified by one of these. */
export type ModuleId =
  | 'initiative'
  | 'timer'
  | 'roller'
  | 'npcs'
  | 'lore'
  | 'calendar'
  | 'handouts'
  | 'notebook'
  | 'planner'
  | 'map'
  | 'audio'
  | 'sanity'
  | 'palette'
  | 'rules'
  | 'stage'
  | 'preview'
  | 'reveal';

/**
 * A module owns its state and exposes up to three views, one per surface.
 * Surfaces render these by id and never import module internals.
 */
export interface ModuleManifest {
  id: ModuleId;
  title: string;
  icon?: string;
  /** default desktop window size */
  size: { w: number; h: number };
  /** live windowed widget on the Desktop surface */
  desktop?: Component;
  /** show in the dock's spawnable "Widgets" rail (default true) */
  dock?: boolean;
  /** authoring/customization tab on the Editors surface */
  editor?: Component;
  /** optional player-facing render hint for the Broadcast surface */
  broadcast?: Component;
  /** can this module push content to the broadcast window? */
  broadcastable?: boolean;
}
