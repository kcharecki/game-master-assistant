import { kvSet, kvGet } from '../../lib/db';
import type { Faction, Relationship, RelationType } from './graph';

export type { Faction, Relationship, RelationType } from './graph';

interface FactionState {
  factions: Faction[];
  relationships: Relationship[];
}

const SEED: FactionState = {
  factions: [
    { id: 'order', name: 'Esoteric Order' },
    { id: 'guard', name: 'Town Guard' },
    { id: 'smugglers', name: 'Smugglers’ Ring' },
    { id: 'scholars', name: 'Miskatonic Scholars' },
  ],
  relationships: [
    { from: 'guard', to: 'order', type: 'serves' },
    { from: 'smugglers', to: 'guard', type: 'owes' },
    { from: 'scholars', to: 'order', type: 'hates' },
    { from: 'smugglers', to: 'order', type: 'allied' },
  ],
};

/** Factions and the relationships between them, rendered as an SVG web. */
class FactionStore {
  factions = $state<Faction[]>([...SEED.factions]);
  relationships = $state<Relationship[]>([...SEED.relationships]);

  addFaction(name = 'New Faction'): Faction {
    const f: Faction = { id: crypto.randomUUID(), name };
    this.factions.push(f);
    this.persist();
    return f;
  }

  renameFaction(id: string, name: string): void {
    const f = this.factions.find((x) => x.id === id);
    if (f) f.name = name;
    this.persist();
  }

  removeFaction(id: string): void {
    this.factions = this.factions.filter((f) => f.id !== id);
    this.relationships = this.relationships.filter((r) => r.from !== id && r.to !== id);
    this.persist();
  }

  addRelationship(from: string, to: string, type: RelationType): Relationship | undefined {
    if (from === to) return undefined;
    const rel: Relationship = { from, to, type };
    this.relationships.push(rel);
    this.persist();
    return rel;
  }

  removeRelationship(index: number): void {
    this.relationships = this.relationships.filter((_, i) => i !== index);
    this.persist();
  }

  persist(): void {
    void kvSet('factions', {
      factions: $state.snapshot(this.factions),
      relationships: $state.snapshot(this.relationships),
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<FactionState>('factions');
    if (saved?.factions) {
      this.factions = saved.factions;
      this.relationships = saved.relationships ?? [];
    }
  }
}

export const factions = new FactionStore();
