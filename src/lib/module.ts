import type { Component } from 'svelte';

/** Every feature/module is identified by one of these. */
export type ModuleId =
  | 'scene'
  | 'initiative'
  | 'conditions'
  | 'timer'
  | 'roller'
  | 'npcs'
  | 'lore'
  | 'calendar'
  | 'factions'
  | 'handouts'
  | 'notebook'
  | 'map'
  | 'audio'
  | 'clues'
  | 'sanity'
  | 'skillcheck'
  | 'statblock'
  | 'quests'
  | 'beats'
  | 'tables'
  | 'improv'
  | 'palette'
  | 'archive'
  | 'spotlight'
  | 'rules'
  | 'dashboard'
  | 'reminders'
  | 'composer'
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
  /** authoring/customization tab on the Editors surface */
  editor?: Component;
  /** optional player-facing render hint for the Broadcast surface */
  broadcast?: Component;
  /** can this module push content to the broadcast window? */
  broadcastable?: boolean;
}
