import { system } from '../../lib/stores/system.svelte';
import { rulesEntries } from './data';
import { forSystem, searchRules, type RuleEntry } from './logic';

export type { RuleEntry } from './logic';

/**
 * Searchable rules reference (#21): a small seed SRD/system rules set, filtered
 * to the active game system and looked up instantly. GM-only.
 */
class RulesStore {
  query = $state('');

  /** Entries for the current system matching the current query. */
  get results(): RuleEntry[] {
    return searchRules(this.query, forSystem(rulesEntries, system.current));
  }
}

export const rules = new RulesStore();
