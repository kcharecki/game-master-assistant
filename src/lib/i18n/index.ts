import { lang, type Locale } from '../stores/lang.svelte';
import { shell } from './messages/shell';
import { combat } from './messages/combat';
import { world } from './messages/world';
import { mapsbroadcast } from './messages/mapsbroadcast';
import { atmosphere } from './messages/atmosphere';
import { dicerules } from './messages/dicerules';
import { prepnotes } from './messages/prepnotes';
import { investigation } from './messages/investigation';
import { utility } from './messages/utility';

type Area = { en: Record<string, string>; pl: Record<string, string> };

const AREAS: Area[] = [
  shell,
  combat,
  world,
  mapsbroadcast,
  atmosphere,
  dicerules,
  prepnotes,
  investigation,
  utility,
];

export const messages: Record<Locale, Record<string, string>> = {
  en: Object.assign({}, ...AREAS.map((a) => a.en)),
  pl: Object.assign({}, ...AREAS.map((a) => a.pl)),
};

/** Pure lookup: key -> string for a locale, falling back to en then the key. */
export function translate(key: string, locale: Locale): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

/** Reactive in components: reads lang.current so it re-renders on switch. */
export function t(key: string): string {
  return translate(key, lang.current);
}

export { lang };
export type { Locale };
