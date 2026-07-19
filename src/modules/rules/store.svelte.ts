import { kvGet, kvSet } from '../../lib/db';
import { loc } from '../../lib/loc';
import { lang } from '../../lib/stores/lang.svelte';
import { system } from '../../lib/stores/system.svelte';
import { toast } from '../../lib/stores/toast.svelte';
import { putOnAir } from '../reveal/bus-actions';
import { rulesEntries, type RuleCategory, type RuleEntry, type Ruling } from './data';
import {
  forSystem,
  byCategory,
  searchRules,
  searchAll,
  rulingsForRule,
  conflictsFor,
  type SearchHit,
} from './logic';

export type { RuleCategory, RuleEntry, Ruling } from './logic';

const CUSTOM_KEY = 'rulesCustom';
const RULINGS_KEY = 'rulings';

interface CustomState {
  custom: RuleEntry[];
  pinned: string[];
  hidden: string[];
}

const BUILTIN_IDS = new Set(rulesEntries.map((e) => e.id));

/**
 * Rules & Rulings (features #21 + #22). A searchable, GM-editable reference
 * library plus a timestamped log of house rules and on-the-fly decisions, so
 * the GM stays consistent. Reference + rulings persist to IndexedDB; the seed
 * set is read-only but can be pinned, hidden, or overridden by a custom entry.
 */
export class RulesStore {
  query = $state('');
  categoryFilter = $state<RuleCategory | null>(null);

  /** GM-authored rules (may share an id with a builtin to override it). */
  custom = $state<RuleEntry[]>([]);
  /** Ids (builtin or custom) the GM pinned to the top. */
  pinned = $state<string[]>([]);
  /** Builtin ids the GM removed from view. */
  hidden = $state<string[]>([]);
  rulings = $state<Ruling[]>([]);

  /** Injected by the app so rulings capture in-play context (round/session). */
  contextLabel: () => string | undefined = () => undefined;

  /** Seed ∪ custom, with overrides + hidden + pin overlay applied. */
  get allRules(): RuleEntry[] {
    const customById = new Map(this.custom.map((c) => [c.id, c]));
    const base = rulesEntries
      .filter((e) => !this.hidden.includes(e.id))
      .map((e) => customById.get(e.id) ?? e);
    const extras = this.custom.filter((c) => !BUILTIN_IDS.has(c.id));
    const pins = new Set(this.pinned);
    return [...base, ...extras].map((e) => (pins.has(e.id) ? { ...e, pinned: true } : e));
  }

  /** Rules for the current system + category, ranked by the current query. */
  get results(): RuleEntry[] {
    const scoped = byCategory(forSystem(this.allRules, system.current), this.categoryFilter);
    return searchRules(this.query, scoped);
  }

  /** Unified rule + ruling hits for the current system and query. */
  get hits(): SearchHit[] {
    return searchAll(this.query, forSystem(this.allRules, system.current), this.systemRulings);
  }

  /** Rulings relevant to the active system. */
  get systemRulings(): Ruling[] {
    return this.rulings.filter((r) => r.system === system.current || r.system === 'both');
  }

  rulingsForRule(ruleId: string): Ruling[] {
    return rulingsForRule(this.rulings, ruleId);
  }

  // ── Reference CRUD ────────────────────────────────────────────────────
  addRule(patch: Partial<RuleEntry> = {}): RuleEntry {
    const entry: RuleEntry = {
      id: crypto.randomUUID(),
      term: patch.term ?? 'New Rule',
      body: patch.body ?? '',
      system: patch.system ?? system.current,
      category: patch.category ?? 'gm',
      aliases: patch.aliases ?? [],
      tags: patch.tags ?? [],
      source: patch.source,
      builtin: false,
    };
    this.custom.push(entry);
    this.persistCustom();
    return entry;
  }

  updateRule(id: string, patch: Partial<Omit<RuleEntry, 'id' | 'builtin'>>): void {
    const c = this.custom.find((x) => x.id === id);
    if (c) {
      Object.assign(c, patch);
    } else if (BUILTIN_IDS.has(id)) {
      // Editing a builtin forks it into an editable custom override.
      const base = rulesEntries.find((e) => e.id === id)!;
      this.custom.push({ ...base, ...patch, builtin: false });
    }
    this.persistCustom();
  }

  /** Delete a custom entry, or hide a builtin from view (undoable). */
  removeRule(id: string): void {
    const custom = this.custom.find((x) => x.id === id);
    if (custom && !BUILTIN_IDS.has(id)) {
      this.custom = this.custom.filter((x) => x.id !== id);
      this.persistCustom();
      toast.undoable('Rule removed', () => {
        this.custom.push(custom);
        this.persistCustom();
      });
      return;
    }
    if (BUILTIN_IDS.has(id)) {
      this.hidden = [...this.hidden, id];
      this.custom = this.custom.filter((x) => x.id !== id);
      this.persistCustom();
      toast.undoable('Rule hidden', () => {
        this.hidden = this.hidden.filter((h) => h !== id);
        this.persistCustom();
      });
    }
  }

  duplicateRule(id: string): RuleEntry | undefined {
    const src = this.allRules.find((e) => e.id === id);
    if (!src) return;
    return this.addRule({ ...src, term: `${src.term} (copy)` });
  }

  togglePin(id: string): void {
    this.pinned = this.pinned.includes(id)
      ? this.pinned.filter((p) => p !== id)
      : [...this.pinned, id];
    this.persistCustom();
  }

  // ── Rulings CRUD ──────────────────────────────────────────────────────
  addRuling(patch: Partial<Ruling> = {}): Ruling {
    const ruling: Ruling = {
      id: crypto.randomUUID(),
      title: patch.title ?? 'New Ruling',
      body: patch.body ?? '',
      system: patch.system ?? system.current,
      ruleId: patch.ruleId,
      tags: patch.tags ?? [],
      createdAt: patch.createdAt ?? new Date().toISOString(),
      sessionLabel: patch.sessionLabel ?? this.contextLabel(),
      status: 'active',
    };
    this.rulings.unshift(ruling);
    this.persistRulings();
    return ruling;
  }

  updateRuling(id: string, patch: Partial<Omit<Ruling, 'id' | 'createdAt'>>): void {
    const r = this.rulings.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.persistRulings();
  }

  setRulingStatus(id: string, status: Ruling['status']): void {
    this.updateRuling(id, { status });
  }

  removeRuling(id: string): void {
    const idx = this.rulings.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const [removed] = this.rulings.splice(idx, 1);
    this.persistRulings();
    toast.undoable('Ruling removed', () => {
      this.rulings.splice(idx, 0, removed);
      this.persistRulings();
    });
  }

  /** Existing active rulings that already cover the same rule as a draft. */
  conflictsFor(draft: { id?: string; ruleId?: string }): Ruling[] {
    return conflictsFor(this.rulings, draft);
  }

  // ── Broadcast ─────────────────────────────────────────────────────────
  airRule(entry: Pick<RuleEntry, 'term' | 'body'>): void {
    putOnAir({
      kind: 'text',
      title: loc(entry.term, lang.current),
      body: loc(entry.body, lang.current),
      theme: 'parchment',
    });
  }

  airRuling(ruling: Pick<Ruling, 'title' | 'body'>): void {
    putOnAir({
      kind: 'text',
      title: loc(ruling.title, lang.current),
      body: loc(ruling.body, lang.current),
      theme: 'parchment',
    });
  }

  // ── Import / export ───────────────────────────────────────────────────
  exportJson(): string {
    return JSON.stringify(
      { custom: $state.snapshot(this.custom), rulings: $state.snapshot(this.rulings) },
      null,
      2,
    );
  }

  importJson(text: string): { rules: number; rulings: number } {
    const data = JSON.parse(text) as { custom?: RuleEntry[]; rulings?: Ruling[] };
    let rules = 0;
    let rulings = 0;
    for (const e of data.custom ?? []) {
      if (e?.id && e?.term) {
        this.custom = this.custom.filter((x) => x.id !== e.id);
        this.custom.push({ ...e, builtin: false });
        rules++;
      }
    }
    for (const r of data.rulings ?? []) {
      if (r?.id && r?.title) {
        this.rulings = this.rulings.filter((x) => x.id !== r.id);
        this.rulings.unshift(r);
        rulings++;
      }
    }
    this.persistCustom();
    this.persistRulings();
    return { rules, rulings };
  }

  // ── Persistence ───────────────────────────────────────────────────────
  persistCustom(): void {
    const state: CustomState = {
      custom: $state.snapshot(this.custom),
      pinned: $state.snapshot(this.pinned),
      hidden: $state.snapshot(this.hidden),
    };
    void kvSet(CUSTOM_KEY, state);
  }

  persistRulings(): void {
    void kvSet(RULINGS_KEY, $state.snapshot(this.rulings));
  }

  async load(): Promise<void> {
    const saved = await kvGet<CustomState>(CUSTOM_KEY);
    if (saved) {
      this.custom = saved.custom ?? [];
      this.pinned = saved.pinned ?? [];
      this.hidden = saved.hidden ?? [];
    }
    const rulings = await kvGet<Ruling[]>(RULINGS_KEY);
    if (rulings) this.rulings = rulings;
  }
}

export const rules = new RulesStore();
