export interface Page {
  id: string;
  title: string;
  body: string;
}

const LINK_RE = /\[\[([^[\]]+)\]\]/g;

/**
 * Extract the wiki-link targets from a body — every `[[Page Title]]`. Titles
 * are trimmed and de-duplicated (case-insensitive, first spelling wins).
 * Pure — unit-tested, no DOM.
 */
export function parseLinks(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(LINK_RE)) {
    const title = m[1].trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/**
 * Resolve a link target to the matching page id, by case-insensitive title.
 * Returns undefined for a dangling link (no such page yet).
 */
export function resolveLink(pages: Page[], title: string): string | undefined {
  const key = title.trim().toLowerCase();
  return pages.find((p) => p.title.trim().toLowerCase() === key)?.id;
}

/**
 * Backlinks for a target page: the ids of all *other* pages whose body links
 * to it by title. A page never backlinks to itself.
 */
export function backlinks(pages: Page[], targetId: string): string[] {
  const target = pages.find((p) => p.id === targetId);
  if (!target) return [];
  const key = target.title.trim().toLowerCase();
  return pages
    .filter(
      (p) => p.id !== targetId && parseLinks(p.body).some((t) => t.toLowerCase() === key)
    )
    .map((p) => p.id);
}
