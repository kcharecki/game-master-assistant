export interface Faction {
  id: string;
  name: string;
}

export type RelationType = 'hates' | 'owes' | 'serves' | 'allied';

export interface Relationship {
  from: string;
  to: string;
  type: RelationType;
}

export interface Point {
  x: number;
  y: number;
}

export interface NodePos extends Point {
  id: string;
}

/**
 * Lay nodes out evenly around a circle. Deterministic and pure so it can be
 * snapshot-tested. First node sits at the top (12 o'clock), going clockwise.
 */
export function circleLayout(
  ids: string[],
  cx: number,
  cy: number,
  radius: number
): NodePos[] {
  const n = ids.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: ids[0], x: cx, y: cy }];
  return ids.map((id, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { id, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

/** Colour per relationship type, for edge rendering. */
export const RELATION_COLOR: Record<RelationType, string> = {
  hates: '#c05b5b',
  owes: '#c7a44e',
  serves: '#6f9bd1',
  allied: '#5fbf8f',
};

/**
 * Resolve a relationship to its two endpoint positions plus a midpoint (for a
 * label). Returns null if either endpoint is missing from the layout.
 */
export function edgeGeometry(
  rel: Relationship,
  positions: NodePos[]
): { a: Point; b: Point; mid: Point; color: string } | null {
  const a = positions.find((p) => p.id === rel.from);
  const b = positions.find((p) => p.id === rel.to);
  if (!a || !b) return null;
  return {
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    color: RELATION_COLOR[rel.type],
  };
}
