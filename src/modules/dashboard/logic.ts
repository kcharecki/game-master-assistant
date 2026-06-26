/** A party member's at-a-glance defensive stats (GM reference only). */
export interface PartyMember {
  id: string;
  name: string;
  ac: number;
  /** passive Perception */
  pp: number;
  saves?: string;
  languages?: string;
  resistances?: string;
}

/**
 * Party sorted for the GM table: highest passive Perception first (so the GM
 * sees the keenest eyes at a glance), ties broken by name. Pure — unit-tested.
 */
export function byPerception(party: PartyMember[]): PartyMember[] {
  return [...party].sort((a, b) => b.pp - a.pp || a.name.localeCompare(b.name));
}

/** The highest passive Perception in the party (0 if empty). Pure. */
export function topPerception(party: PartyMember[]): number {
  return party.reduce((max, p) => Math.max(max, p.pp), 0);
}
