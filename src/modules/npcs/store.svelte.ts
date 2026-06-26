import { kvSet, kvGet } from '../../lib/db';

export type Disposition = 'ally' | 'neutral' | 'hostile';
export interface Npc {
  id: string;
  name: string;
  role: string;
  disposition: Disposition;
  voice?: string;
}

const SEED: Npc[] = [
  { id: 'et', name: 'Captain Eli Thorne', role: 'Harbormaster', disposition: 'ally', voice: 'gravelly, slow' },
  { id: 'mw', name: 'Mara Whitlock', role: 'Archivist', disposition: 'ally' },
  { id: 'do', name: 'Deep One Hybrid', role: 'Monster', disposition: 'hostile' },
];

/** NPC roster state. Shared by the NPC desktop widget and the NPC editor tab. */
class NpcStore {
  list = $state<Npc[]>([...SEED]);

  add(name = 'New NPC'): Npc {
    const npc: Npc = { id: crypto.randomUUID(), name, role: '', disposition: 'neutral' };
    this.list.push(npc);
    this.persist();
    return npc;
  }

  update(id: string, patch: Partial<Omit<Npc, 'id'>>): void {
    const npc = this.list.find((n) => n.id === id);
    if (npc) Object.assign(npc, patch);
    this.persist();
  }

  remove(id: string): void {
    this.list = this.list.filter((n) => n.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('npcs', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Npc[]>('npcs');
    if (saved?.length) this.list = saved;
  }
}

export const npcs = new NpcStore();
