<script lang="ts">
  import { lore } from './store.svelte';
  import { buildGraph, layoutGraph } from './graph';
  import type { PageKind } from './logic';
  import { t } from '../../lib/i18n';
  import { loc } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';

  // Called after a node is picked so the host can flip back to the page editor.
  let { onpick }: { onpick?: (id: string) => void } = $props();

  // Kind → node hue. Deliberately NOT gold (gold = on-air only). Muted,
  // distinct tones drawn from the séance-green palette family.
  const KIND_C: Record<PageKind, string> = {
    place: '#6fae86',
    person: '#7fb0c9',
    faction: '#b58fc0',
    item: '#c9a56a',
    event: '#c86a60',
    creature: '#6cc0a8',
    concept: '#9aa8a0',
  };

  // Fixed layout canvas; the SVG viewBox scales it to fit the pane.
  const W = 820;
  const H = 560;
  const R = 9; // node radius

  const model = $derived.by(() => {
    const pages = lore.pages;
    const g = buildGraph($state.snapshot(pages) as typeof pages);
    const pos = layoutGraph(g.nodes, g.edges, { w: W, h: H });
    const title = new Map(pages.map((p) => [p.id, loc(p.title, lang.current) || t('lore.untitled')]));

    const nodes = g.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: title.get(n.id) ?? '',
      ...(pos.get(n.id) ?? { x: W / 2, y: H / 2 }),
    }));

    // Trim each edge to the node rims so the arrowhead sits outside the circle.
    const edges = g.edges.map((e, i) => {
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      return {
        id: `${e.from}-${e.to}-${i}`,
        x1: a.x + ux * R,
        y1: a.y + uy * R,
        x2: b.x - ux * (R + 5),
        y2: b.y - uy * (R + 5),
      };
    });

    return { nodes, edges };
  });

  function pick(id: string) {
    lore.select(id);
    onpick?.(id);
  }
</script>

{#if lore.pages.length < 2}
  <div class="lrg-empty">{t('lore.graphEmpty')}</div>
{:else}
  <div class="lrg">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('lore.graph')}>
      <defs>
        <marker id="lrg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" fill="var(--line-strong, rgba(134,178,153,0.45))" />
        </marker>
      </defs>

      {#each model.edges as e (e.id)}
        <line class="lrg-edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} marker-end="url(#lrg-arrow)" />
      {/each}

      {#each model.nodes as n (n.id)}
        <g
          class="lrg-node"
          class:on={n.id === lore.selectedId}
          role="button"
          tabindex="0"
          aria-label={n.label}
          onclick={() => pick(n.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pick(n.id);
            }
          }}
        >
          {#if n.id === lore.selectedId}
            <circle class="lrg-ring" cx={n.x} cy={n.y} r={R + 4} />
          {/if}
          <circle class="lrg-dot" cx={n.x} cy={n.y} r={R} style:--lrg-c={KIND_C[n.kind]}>
            <title>{n.label}</title>
          </circle>
          <text class="lrg-lbl" x={n.x} y={n.y + R + 13}>{n.label}</text>
        </g>
      {/each}
    </svg>
  </div>
{/if}

<style>
  .lrg {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .lrg svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .lrg-empty {
    margin: auto;
    padding: 40px 24px;
    text-align: center;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
  }
  .lrg-edge {
    stroke: var(--line2);
    stroke-width: 1.2;
  }
  .lrg-node:focus-visible .lrg-dot {
    stroke: var(--green);
    stroke-width: 2.5;
  }
  .lrg-node {
    cursor: pointer;
    outline: none;
  }
  .lrg-dot {
    fill: var(--bg2);
    stroke: var(--lrg-c);
    stroke-width: 2;
    transition:
      stroke 0.12s ease,
      r 0.12s ease;
  }
  .lrg-node:hover .lrg-dot {
    stroke: var(--green);
  }
  .lrg-node.on .lrg-dot {
    fill: var(--green);
    stroke: var(--green);
  }
  .lrg-ring {
    fill: none;
    stroke: var(--green);
    stroke-width: 1.6;
    opacity: 0.4;
  }
  .lrg-lbl {
    fill: var(--muted);
    font-size: 11px;
    text-anchor: middle;
    pointer-events: none;
    font-family: var(--serif), Georgia, serif;
  }
  .lrg-node:hover .lrg-lbl,
  .lrg-node.on .lrg-lbl {
    fill: var(--txt);
  }
</style>
