import { describe, it, expect } from 'vitest';
import { moduleList } from './registry';
import { categorized, infoFor, categoryMap, FALLBACK, CATEGORY_ORDER } from './categories';

const desktopModules = moduleList.filter((m) => m.desktop);

describe('categories', () => {
  it('places every desktop module in exactly one group', () => {
    const groups = categorized(desktopModules);
    const seen = new Map<string, number>();
    for (const g of groups) {
      for (const m of g.items) {
        seen.set(m.id, (seen.get(m.id) ?? 0) + 1);
      }
    }
    for (const m of desktopModules) {
      expect(seen.get(m.id), `${m.id} should appear once`).toBe(1);
    }
    // No extras, no drops.
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(desktopModules.length);
  });

  it('maps every desktop module to a non-fallback category', () => {
    for (const m of desktopModules) {
      expect(categoryMap[m.id], `${m.id} should be mapped`).toBeDefined();
    }
  });

  it('falls back to Other for an unknown id', () => {
    expect(infoFor('nope' as never)).toEqual(FALLBACK);
    const groups = categorized([
      { id: 'nope' as never, title: 'Mystery', size: { w: 1, h: 1 } },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('Other');
  });

  it('returns groups in CATEGORY_ORDER with items sorted by title', () => {
    const groups = categorized(desktopModules);
    const order = groups.map((g) => g.category);
    const expected = [...CATEGORY_ORDER].filter((c) => order.includes(c));
    expect(order).toEqual(expected);
    for (const g of groups) {
      const titles = g.items.map((i) => i.title);
      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    }
  });
});
