import { kvGet, kvSet } from '../../lib/db';
import { locEq, type LocalizedText } from '../../lib/loc';

/** A spell definition in the shared library. NPCs reference these by id. */
export interface Spell {
  id: string;
  name: LocalizedText;
  /** magic-point / sanity cost, e.g. "8 Magic Points (+2d6 SAN to cause)" */
  cost?: LocalizedText;
  /** casting time, e.g. "1 round", "1 day" */
  castingTime?: LocalizedText;
  /** alternative names, ";"-separated */
  altNames?: LocalizedText;
  description?: LocalizedText;
}

const SEED: Spell[] = [
  {
    id: 'spl-blindness',
    name: 'Cause / Cure Blindness',
    cost: '8 Magic Points (+2d6 SAN to cause)',
    castingTime: '1 day',
    description:
      'The target permanently and totally loses their sight, as if from a stroke. The same spell can restore sight if the eyes and optic nerves are undamaged. Both versions cost 8 Magic Points and require a one-day ritual. The caster must win an opposed POW roll against the target (automatic success if the target permits the casting).',
    altNames: 'Gift of Sight; Shade of Darkness; Pharaoh’s Curse',
  },
  {
    id: 'spl-dread-azathoth',
    name: 'Dread Curse of Azathoth',
    cost: '4 Magic Points; 1d6 SAN',
    castingTime: '1 round',
    description:
      'The sorcerer draws on the energy of the Outer God to drain POWER directly from the victim. The caster must win an opposed POW roll against the target; on success the victim loses 3d6 POW. Knowing the spell implies knowledge of the secret Last Syllable, which can be turned against enemies and grants respect and fear among those versed in the Mythos.',
    altNames:
      'Utterance of the Last Syllable; Pitiful Draining; By the True Name Thy Power Shall Be Consumed',
  },
];

/** Reactive shared spell library. One definition, referenced by many NPCs. */
class SpellLibrary {
  list = $state<Spell[]>([...SEED]);
  private loaded = false;

  add(name = 'New Spell'): Spell {
    const spell: Spell = { id: crypto.randomUUID(), name };
    this.list.push(spell);
    this.persist();
    return spell;
  }

  update(id: string, patch: Partial<Omit<Spell, 'id'>>): void {
    const spell = this.list.find((s) => s.id === id);
    if (spell) Object.assign(spell, patch);
    this.persist();
  }

  remove(id: string): void {
    this.list = this.list.filter((s) => s.id !== id);
    this.persist();
  }

  get(id: string): Spell | undefined {
    return this.list.find((s) => s.id === id);
  }

  findByName(name: LocalizedText): Spell | undefined {
    return this.list.find((s) => locEq(s.name, name));
  }

  /**
   * Import spell definitions, reusing an existing library entry when the name
   * already matches (any language) so imports don't duplicate. Returns the
   * resolved spells (existing or freshly created).
   */
  importMany(inputs: Omit<Spell, 'id'>[]): Spell[] {
    const out: Spell[] = [];
    for (const input of inputs) {
      const existing = this.findByName(input.name);
      if (existing) {
        out.push(existing);
        continue;
      }
      out.push({ id: crypto.randomUUID(), ...input });
      this.list.push(out[out.length - 1]);
    }
    this.persist();
    return out;
  }

  persist(): void {
    void kvSet('spellLibrary', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const saved = await kvGet<Spell[]>('spellLibrary');
    if (saved?.length) this.list = saved;
  }
}

export const spellLibrary = new SpellLibrary();
