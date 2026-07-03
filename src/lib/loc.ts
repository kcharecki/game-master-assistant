import type { Locale } from './stores/lang.svelte';

/**
 * A user-facing string that may carry per-language variants. A plain string is
 * treated as the same text in every language (legacy + terse values); an object
 * holds explicit English/Polish variants. Resolving always falls back to the
 * other language so nothing renders blank.
 */
export type LocalizedText = string | { en?: string; pl?: string };

/** Resolve a localized value to a plain string for `lang` (with fallbacks). */
export function loc(v: LocalizedText | undefined | null, lang: Locale): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.en || v.pl || '';
}

/**
 * Set the `lang` variant of a localized value to `text`, preserving the other
 * language. A plain-string base seeds both languages first so editing one never
 * drops the other.
 */
export function setLoc(v: LocalizedText | undefined, lang: Locale, text: string): LocalizedText {
  const base: { en?: string; pl?: string } =
    typeof v === 'string' ? { en: v, pl: v } : { ...(v ?? {}) };
  base[lang] = text;
  return base;
}

/**
 * Resolve a localized value and split it into paragraphs on line breaks (any run
 * of newlines starts a new paragraph). Blank entries are dropped. Lets imported
 * multi-paragraph text render as distinct blocks instead of one run-on wall.
 */
export function paragraphs(v: LocalizedText | undefined | null, lang: Locale): string[] {
  return loc(v, lang)
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Every non-empty variant of a localized value (used for cross-language search). */
export function locStrings(v: LocalizedText | undefined | null): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return v ? [v] : [];
  return [v.en, v.pl].filter((s): s is string => !!s);
}

/** True if any variant of `v` matches any variant of `other` (case-insensitive). */
export function locEq(v: LocalizedText | undefined, other: LocalizedText | undefined): boolean {
  const a = locStrings(v).map((s) => s.trim().toLowerCase());
  const b = new Set(locStrings(other).map((s) => s.trim().toLowerCase()));
  return a.some((s) => s && b.has(s));
}
