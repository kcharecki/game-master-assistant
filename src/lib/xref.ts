/**
 * Cross-module "open this reference" signal. Any module (notebook wikilinks,
 * planner ref chips, …) fires `openRef(name)`; App.svelte listens once and
 * resolves `name` across lore pages + NPCs, then opens the right editor. Keeps
 * the event name in one place so no module hard-codes a foreign string.
 */
export const OPEN_REF_EVENT = 'app:openref';

/** Dispatch a cross-module open-reference request for `name`. */
export function openRef(name: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_REF_EVENT, { detail: { name } }));
}
