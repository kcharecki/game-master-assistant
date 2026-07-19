import type { GameSystem } from '../../lib/system';
import type { RuleCategory, RuleEntry, Ruling } from './data';

export type { RuleCategory, RuleEntry, Ruling } from './data';

/** Entries relevant to a system: system-specific ones plus the shared 'both'. */
export function forSystem<T extends { system: GameSystem | 'both' }>(
  entries: T[],
  system: GameSystem,
): T[] {
  return entries.filter((e) => e.system === system || e.system === 'both');
}

/** Filter to a single category, or pass through when `category` is null. */
export function byCategory(entries: RuleEntry[], category: RuleCategory | null): RuleEntry[] {
  return category ? entries.filter((e) => e.category === category) : entries;
}

/**
 * Score a rule against a query. Higher = better match. 0 = no match.
 * Ranks term > aliases > tags > body, with a start-of-term bonus.
 */
function scoreRule(e: RuleEntry, q: string): number {
  const term = e.term.toLowerCase();
  if (term.startsWith(q)) return 5;
  if (term.includes(q)) return 4;
  if (e.aliases.some((a) => a.toLowerCase().includes(q))) return 3;
  if (e.tags.some((tg) => tg.toLowerCase().includes(q))) return 2;
  if (e.body.toLowerCase().includes(q)) return 1;
  return 0;
}

/**
 * Search rules by free text over term + aliases + tags + body (case-insensitive).
 * Empty query returns everything, pinned first then A→Z. Non-empty ranks by
 * match quality; ties broken by pinned, then term A→Z. Pure — unit-tested.
 */
export function searchRules(query: string, entries: RuleEntry[]): RuleEntry[] {
  const q = query.trim().toLowerCase();
  const byPinThenTerm = (a: RuleEntry, b: RuleEntry) =>
    Number(!!b.pinned) - Number(!!a.pinned) || a.term.localeCompare(b.term);
  if (!q) return [...entries].sort(byPinThenTerm);
  return entries
    .map((e) => ({ e, score: scoreRule(e, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || byPinThenTerm(a.e, b.e))
    .map((x) => x.e);
}

/** A unified search hit across the reference library and the rulings log. */
export type SearchHit =
  | { type: 'rule'; rule: RuleEntry }
  | { type: 'ruling'; ruling: Ruling };

function scoreRuling(rl: Ruling, q: string): number {
  const title = rl.title.toLowerCase();
  if (title.startsWith(q)) return 5;
  if (title.includes(q)) return 4;
  if (rl.tags.some((tg) => tg.toLowerCase().includes(q))) return 2;
  if (rl.body.toLowerCase().includes(q)) return 1;
  return 0;
}

/**
 * Combined search over reference rules and active rulings. Rules and rulings are
 * ranked by the same 0–5 scale; rules win ties so canonical text leads.
 */
export function searchAll(query: string, rules: RuleEntry[], rulings: Ruling[]): SearchHit[] {
  const q = query.trim().toLowerCase();
  const activeRulings = rulings.filter((rl) => rl.status === 'active');
  if (!q) {
    return [
      ...searchRules('', rules).map((rule): SearchHit => ({ type: 'rule', rule })),
      ...activeRulings.map((ruling): SearchHit => ({ type: 'ruling', ruling })),
    ];
  }
  const scored: { hit: SearchHit; score: number; rank: number }[] = [];
  for (const rule of rules) {
    const score = scoreRule(rule, q);
    if (score > 0) scored.push({ hit: { type: 'rule', rule }, score, rank: 1 });
  }
  for (const ruling of activeRulings) {
    const score = scoreRuling(ruling, q);
    if (score > 0) scored.push({ hit: { type: 'ruling', ruling }, score, rank: 0 });
  }
  return scored.sort((a, b) => b.score - a.score || b.rank - a.rank).map((x) => x.hit);
}

/** Active rulings that clarify a given reference entry, newest first. */
export function rulingsForRule(rulings: Ruling[], ruleId: string): Ruling[] {
  return rulings
    .filter((rl) => rl.status === 'active' && rl.ruleId === ruleId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Existing active rulings that already cover the same reference entry as a draft
 * — surfaced as a consistency warning before the GM logs a conflicting call.
 */
export function conflictsFor(
  rulings: Ruling[],
  draft: { id?: string; ruleId?: string },
): Ruling[] {
  if (!draft.ruleId) return [];
  return rulings.filter(
    (rl) => rl.status === 'active' && rl.ruleId === draft.ruleId && rl.id !== draft.id,
  );
}
