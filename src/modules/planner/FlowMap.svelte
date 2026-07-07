<script lang="ts">
  import { planner } from './store.svelte';

  // "Beats as nodes, branch as a fork." A horizontal spine of beat nodes; each
  // beat's terminal branches (outcomes with no matching beat) rise off it on an
  // elbow riser to a labelled fork node. Current beat glows gold; click a spine
  // node to jump there.
  let { compact = false }: { compact?: boolean } = $props();

  const TYPE_C: Record<string, string> = {
    intro: '#6fae86',
    scene: '#7fb0c9',
    social: '#b58fc0',
    combat: '#c86a60',
    reveal: '#6cc0a8',
  };

  function clip(s: string, n: number): string {
    const t = s.trim();
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
  }

  interface ForkView {
    fx: number;
    fy: number;
    label: string;
    title: string;
  }
  interface NodeView {
    id: string;
    type: string;
    title: string;
    x: number;
    i: number;
    cur: boolean;
    done: boolean;
    forks: ForkView[];
  }

  const m = $derived.by(() => {
    const G = compact ? 34 : 52; // base node gap
    const PAD = 14;
    const R = compact ? 5 : 6; // spine node radius
    const FR = compact ? 3.5 : 4.5; // fork node radius
    const FY = compact ? 16 : 22; // first fork rise above spine
    const FDX = compact ? 11 : 14; // fork column offset right of node
    const FSTEP = compact ? 8 : 10; // vertical step between stacked forks
    const LBL = compact ? 0 : 6.0; // px per label char (0 = no labels)
    const LBLMAX = 16; // label char cap

    const beats = planner.beats;
    const rows = beats.map((b, i) => {
      const terms = b.branches.filter((br) => br.to.trim() && !planner.branchTargetId(br.to));
      return { b, i, terms };
    });

    const maxStack = rows.reduce((mx, r) => Math.max(mx, r.terms.length), 0);
    const topPad = maxStack ? FY + (maxStack - 1) * FSTEP + FR + 4 : compact ? 6 : 8;
    const BASE = topPad;
    const H = BASE + (compact ? 12 : 18);

    const nodes: NodeView[] = [];
    let x = PAD;
    let width = PAD;
    for (const r of rows) {
      const forks: ForkView[] = r.terms.map((br, k) => {
        const label = LBL ? clip(br.to, LBLMAX) : '';
        return {
          fx: x + FDX,
          fy: BASE - FY - k * FSTEP,
          label,
          title: `${br.cond} → ${br.to}`,
        };
      });
      nodes.push({
        id: r.b.id,
        type: r.b.type,
        title: r.b.title,
        x,
        i: r.i,
        cur: r.b.id === planner.currentId,
        done: r.b.status === 'done',
        forks,
      });
      // reserve room so a fork's node + label clears the next spine node
      const labelW = forks.length ? Math.min(LBLMAX, Math.max(...r.terms.map((b) => b.to.trim().length))) * LBL : 0;
      const forkAdvance = forks.length ? FDX + FR + 4 + labelW + 8 : 0;
      width = Math.max(width, x + Math.max(R, forkAdvance));
      x += Math.max(G, forkAdvance);
    }
    width += PAD;

    return { R, FR, BASE, H, width, nodes, spineX2: nodes.length ? nodes[nodes.length - 1].x : PAD };
  });
</script>

<div class="pfm">
  <svg viewBox="0 0 {m.width} {m.H}" width={m.width} height={m.H} role="img" aria-label="Flow map">
    <!-- spine -->
    {#if m.nodes.length > 1}
      <line class="pfm-spine" x1={m.nodes[0].x} y1={m.BASE} x2={m.spineX2} y2={m.BASE} />
    {/if}

    <!-- forks: elbow riser + node (+ label in editor) -->
    {#each m.nodes as n (n.id)}
      {#each n.forks as f (f.fx + '-' + f.fy)}
        <path class="pfm-forkline" d="M {n.x} {m.BASE} L {f.fx} {m.BASE} L {f.fx} {f.fy}" />
        <circle class="pfm-fork" cx={f.fx} cy={f.fy} r={m.FR}><title>{f.title}</title></circle>
        {#if f.label}<text class="pfm-flabel" x={f.fx + m.FR + 4} y={f.fy + 3}>{f.label}</text>{/if}
      {/each}
    {/each}

    <!-- spine nodes -->
    {#each m.nodes as n (n.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <g
        class="pfm-node"
        class:cur={n.cur}
        class:done={n.done}
        role="button"
        tabindex="-1"
        aria-label={n.title}
        onclick={() => planner.jumpTo(n.id)}
      >
        {#if n.cur}<circle class="pfm-ring" cx={n.x} cy={m.BASE} r={m.R + 3} />{/if}
        <circle
          class="pfm-dot"
          cx={n.x}
          cy={m.BASE}
          r={n.cur ? m.R + 1 : m.R}
          style:--pfm-c={n.cur ? 'var(--green)' : (TYPE_C[n.type] ?? 'var(--faint)')}
        >
          <title>{n.title}</title>
        </circle>
        {#if !compact}<text class="pfm-n" x={n.x} y={m.BASE + 15}>{n.i + 1}</text>{/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .pfm {
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 0;
  }
  .pfm::-webkit-scrollbar {
    display: none;
  }
  svg {
    display: block;
    max-width: none;
  }
  .pfm-spine {
    stroke: var(--line2);
    stroke-width: 1;
  }
  .pfm-forkline {
    fill: none;
    stroke: var(--edge-gold);
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }
  .pfm-fork {
    fill: var(--bg2);
    stroke: var(--gold);
    stroke-width: 1.4;
  }
  .pfm-flabel {
    fill: var(--gold);
    font-size: 9px;
    opacity: 0.85;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pfm-node {
    cursor: pointer;
    outline: none;
  }
  .pfm-dot {
    fill: var(--bg2);
    stroke: var(--pfm-c);
    stroke-width: 1.6;
    transition:
      stroke 0.12s ease,
      r 0.12s ease;
  }
  .pfm-node.done .pfm-dot {
    fill: var(--pfm-c);
    opacity: 0.5;
  }
  .pfm-node.cur .pfm-dot {
    fill: var(--green);
  }
  .pfm-ring {
    fill: none;
    stroke: var(--green);
    stroke-width: 1.4;
    opacity: 0.35;
  }
  .pfm-node:hover .pfm-dot {
    stroke: var(--green);
  }
  .pfm-n {
    fill: var(--faint);
    font-size: 8.5px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .pfm-node.cur .pfm-n {
    fill: var(--green);
  }
</style>
