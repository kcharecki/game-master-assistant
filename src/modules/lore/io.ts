import { migratePage, type Page } from './logic';

/** Wrapper schema for an exported lore file. */
export interface LoreExport {
  version: number;
  /** image blobs are NOT bundled — imageId asset ids won't resolve elsewhere */
  note: string;
  pages: Page[];
}

export const LORE_EXPORT_VERSION = 1;

const IMAGE_NOTE =
  'Image blobs are not bundled; imageId asset ids only resolve in the campaign they were exported from.';

/**
 * Serialize pages to a pretty, portable JSON string. Every content field is
 * kept as-is (bilingual title/summary/body/secret, aliases, tags, kind, slug,
 * playerSafe, pinned, imageId, updatedAt) inside a `{version, note, pages}`
 * wrapper. Pure — unit-tested.
 */
export function exportPages(pages: Page[]): string {
  const file: LoreExport = { version: LORE_EXPORT_VERSION, note: IMAGE_NOTE, pages };
  return JSON.stringify(file, null, 2);
}

/**
 * Parse an import string into valid Pages. Accepts a `{version, pages}` wrapper
 * or a bare page array. Each record runs through `migratePage`, so partial or
 * foreign JSON still yields complete Pages (fresh slugs where missing, unique
 * within the import). Guards `JSON.parse` and shape — bad JSON returns
 * `{pages: [], error}` instead of throwing. Pure — unit-tested.
 */
export function parseImport(text: string): { pages: Page[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { pages: [], error: 'Invalid JSON.' };
  }
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { pages?: unknown }).pages)
      ? (raw as { pages: unknown[] }).pages
      : undefined;
  if (!list) return { pages: [], error: 'Not a lore export.' };

  const taken = new Set<string>();
  const pages = list.map((r) => migratePage(r, taken));
  return { pages };
}
