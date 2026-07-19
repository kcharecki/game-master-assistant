import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

const putOnAir = vi.fn();
vi.mock('../reveal/bus-actions', () => ({ putOnAir: (...a: unknown[]) => putOnAir(...a) }));

import { kvGet, kvSet } from '../../lib/db';
import { system } from '../../lib/stores/system.svelte';
import { RulesStore } from './store.svelte';
import { rulesEntries } from './data';

const BUILTIN = rulesEntries[0]; // first seed entry

beforeEach(() => {
  vi.clearAllMocks();
  system.current = 'dnd5e';
});

describe('reference CRUD', () => {
  it('adds a custom rule and finds it in allRules', () => {
    const s = new RulesStore();
    const before = s.allRules.length;
    const e = s.addRule({ term: 'Homebrew Parry', category: 'combat' });
    expect(e.builtin).toBe(false);
    expect(s.allRules).toHaveLength(before + 1);
    expect(kvSet).toHaveBeenCalledWith('rulesCustom', expect.anything());
  });

  it('editing a builtin forks it into an editable override', () => {
    const s = new RulesStore();
    s.updateRule(BUILTIN.id, { body: 'my clearer wording' });
    const shown = s.allRules.find((e) => e.id === BUILTIN.id)!;
    expect(shown.body).toBe('my clearer wording');
    expect(shown.builtin).toBe(false);
    // original seed object untouched
    expect(rulesEntries[0].body).not.toBe('my clearer wording');
  });

  it('removing a custom rule drops it (undoable)', () => {
    const s = new RulesStore();
    const e = s.addRule({ term: 'Temp' });
    s.removeRule(e.id);
    expect(s.allRules.find((x) => x.id === e.id)).toBeUndefined();
  });

  it('removing a builtin hides it', () => {
    const s = new RulesStore();
    s.removeRule(BUILTIN.id);
    expect(s.allRules.find((x) => x.id === BUILTIN.id)).toBeUndefined();
    expect(s.hidden).toContain(BUILTIN.id);
  });

  it('duplicate clones with a (copy) suffix', () => {
    const s = new RulesStore();
    const dup = s.duplicateRule(BUILTIN.id)!;
    expect(dup.term).toBe(`${BUILTIN.term} (copy)`);
    expect(dup.builtin).toBe(false);
  });

  it('togglePin floats an entry and persists', () => {
    const s = new RulesStore();
    s.togglePin(BUILTIN.id);
    expect(s.allRules.find((e) => e.id === BUILTIN.id)?.pinned).toBe(true);
    s.togglePin(BUILTIN.id);
    expect(s.allRules.find((e) => e.id === BUILTIN.id)?.pinned).toBeUndefined();
  });
});

describe('search + filtering', () => {
  it('results respect system + category + query', () => {
    const s = new RulesStore();
    system.current = 'dnd5e';
    s.categoryFilter = 'conditions';
    s.query = 'poison';
    const ids = s.results.map((r) => r.id);
    expect(ids).toContain('poisoned');
    expect(s.results.every((r) => r.category === 'conditions')).toBe(true);
  });

  it('coc entries hidden under dnd system', () => {
    const s = new RulesStore();
    system.current = 'dnd5e';
    expect(s.results.find((r) => r.system === 'coc7e')).toBeUndefined();
  });
});

describe('rulings', () => {
  it('addRuling auto-stamps createdAt and session context', () => {
    const s = new RulesStore();
    s.contextLabel = () => 'Session 3';
    const r = s.addRuling({ title: 'Nat 1 auto-fails', ruleId: BUILTIN.id });
    expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.sessionLabel).toBe('Session 3');
    expect(r.status).toBe('active');
    expect(kvSet).toHaveBeenCalledWith('rulings', expect.anything());
  });

  it('rulingsForRule returns active links newest first', () => {
    const s = new RulesStore();
    s.addRuling({ title: 'old', ruleId: BUILTIN.id, createdAt: '2026-01-01T00:00:00.000Z' });
    s.addRuling({ title: 'new', ruleId: BUILTIN.id, createdAt: '2026-06-01T00:00:00.000Z' });
    expect(s.rulingsForRule(BUILTIN.id).map((r) => r.title)).toEqual(['new', 'old']);
  });

  it('retired rulings drop out of hits but stay in the log', () => {
    const s = new RulesStore();
    system.current = 'dnd5e';
    const r = s.addRuling({ title: 'Zzxq ruling', system: 'dnd5e' });
    s.query = 'Zzxq';
    expect(s.hits.some((h) => h.type === 'ruling')).toBe(true);
    s.setRulingStatus(r.id, 'retired');
    expect(s.hits.some((h) => h.type === 'ruling')).toBe(false);
    expect(s.rulings).toHaveLength(1);
  });

  it('conflictsFor flags an existing active ruling on the same rule', () => {
    const s = new RulesStore();
    s.addRuling({ title: 'first', ruleId: BUILTIN.id });
    expect(s.conflictsFor({ ruleId: BUILTIN.id })).toHaveLength(1);
    expect(s.conflictsFor({ ruleId: 'nonexistent' })).toHaveLength(0);
  });

  it('removeRuling drops it (undoable)', () => {
    const s = new RulesStore();
    const r = s.addRuling({ title: 'temp' });
    s.removeRuling(r.id);
    expect(s.rulings.find((x) => x.id === r.id)).toBeUndefined();
  });
});

describe('broadcast', () => {
  it('airRule sends a parchment text payload', () => {
    const s = new RulesStore();
    s.airRule({ term: 'Cover', body: 'blocks line of sight' });
    expect(putOnAir).toHaveBeenCalledWith({
      kind: 'text',
      title: 'Cover',
      body: 'blocks line of sight',
      theme: 'parchment',
    });
  });
});

describe('import / export', () => {
  it('round-trips custom rules and rulings', () => {
    const s = new RulesStore();
    s.addRule({ term: 'Exported Rule' });
    s.addRuling({ title: 'Exported Ruling' });
    const json = s.exportJson();

    const s2 = new RulesStore();
    const counts = s2.importJson(json);
    expect(counts.rules).toBe(1);
    expect(counts.rulings).toBe(1);
    expect(s2.custom.some((c) => c.term === 'Exported Rule')).toBe(true);
    expect(s2.rulings.some((r) => r.title === 'Exported Ruling')).toBe(true);
  });

  it('import is idempotent by id', () => {
    const s = new RulesStore();
    const e = s.addRule({ term: 'Once' });
    const json = JSON.stringify({ custom: [e, e], rulings: [] });
    s.importJson(json);
    expect(s.custom.filter((c) => c.id === e.id)).toHaveLength(1);
  });
});

describe('load', () => {
  it('hydrates custom state and rulings from kv', async () => {
    (kvGet as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
      if (key === 'rulesCustom') {
        return { custom: [], pinned: [BUILTIN.id], hidden: [] };
      }
      if (key === 'rulings') {
        return [{ id: 'x', title: 'Saved', body: '', system: 'both', tags: [], createdAt: '2026-01-01T00:00:00.000Z', status: 'active' }];
      }
      return undefined;
    });
    const s = new RulesStore();
    await s.load();
    expect(s.pinned).toContain(BUILTIN.id);
    expect(s.rulings).toHaveLength(1);
  });
});
