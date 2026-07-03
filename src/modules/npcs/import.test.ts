import { describe, it, expect } from 'vitest';
import { parseNpcs, parseSpells } from './import';

describe('parseNpcs', () => {
  it('flags invalid JSON', () => {
    expect(parseNpcs('{not json').error).toBe('invalid-json');
    expect(parseNpcs('   ').error).toBe('empty');
  });

  it('parses a single object and coerces fields', () => {
    const { items, error } = parseNpcs(
      JSON.stringify({
        name: 'Mumia',
        role: 'Powłoka grozy',
        disposition: 'HOSTILE',
        stats: [{ key: 'S', val: 105 }],
        attacks: [{ name: 'Walka', chance: '70%', damage: '1K6+MO' }],
        skills: [{ name: 'Ukrywanie', value: '50%' }],
        armor: '2 skin points',
        sanityLoss: '1/1K8',
      }),
    );
    expect(error).toBeUndefined();
    expect(items).toHaveLength(1);
    const n = items[0];
    expect(n.name).toBe('Mumia');
    expect(n.disposition).toBe('hostile'); // lowercased + validated
    expect(n.stats).toEqual([{ key: 'S', val: '105' }]); // number coerced to string
    expect(n.attacks?.[0]).toMatchObject({ name: 'Walka', chance: '70%', damage: '1K6+MO' });
    expect(n.skills?.[0]).toEqual({ name: 'Ukrywanie', value: '50%' });
  });

  it('parses an array and drops entries without a name', () => {
    const { items } = parseNpcs(JSON.stringify([{ name: 'A' }, { role: 'no name' }, { name: 'B' }]));
    expect(items.map((n) => n.name)).toEqual(['A', 'B']);
  });

  it('ignores an unknown disposition (falls back to undefined → neutral later)', () => {
    const { items } = parseNpcs(JSON.stringify({ name: 'X', disposition: 'friendly' }));
    expect(items[0].disposition).toBeUndefined();
  });

  it('reports when no valid NPC is present', () => {
    expect(parseNpcs(JSON.stringify([{ role: 'x' }])).error).toBe('no-valid-npcs');
  });

  it('keeps bilingual { en, pl } field objects', () => {
    const { items } = parseNpcs(
      JSON.stringify({
        name: { en: 'Mummy', pl: 'Mumia' },
        role: { en: 'Shell of dread', pl: 'Powłoka grozy' },
        attacks: [{ name: { en: 'Fighting', pl: 'Walka' }, chance: '70%', damage: '1d6+DB' }],
      }),
    );
    expect(items[0].name).toEqual({ en: 'Mummy', pl: 'Mumia' });
    expect(items[0].role).toEqual({ en: 'Shell of dread', pl: 'Powłoka grozy' });
    // chance is the same in both languages → stays a plain string
    expect(items[0].attacks?.[0]).toEqual({
      name: { en: 'Fighting', pl: 'Walka' },
      chance: '70%',
      damage: '1d6+DB',
    });
  });
});

describe('parseSpells', () => {
  it('parses inline spells with alt field names', () => {
    const { items } = parseSpells(
      JSON.stringify({ name: 'Dread Curse', casting_time: '1 round', desc: 'drains POW' }),
    );
    expect(items[0]).toMatchObject({
      name: 'Dread Curse',
      castingTime: '1 round',
      description: 'drains POW',
    });
  });

  it('reports empty and invalid', () => {
    expect(parseSpells('').error).toBe('empty');
    expect(parseSpells('nope').error).toBe('invalid-json');
    expect(parseSpells('[]').error).toBe('empty');
  });
});
