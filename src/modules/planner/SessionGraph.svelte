<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { planner } from './store.svelte';
  import { t } from '../../lib/i18n';

  // Command Deck "Session Graph": beats auto-laid on a layered spine, branches as
  // routed edges. Pan (drag empty canvas), zoom (wheel / buttons). Click a card =
  // inspect, double-click = move the run cursor. Drag a card's edge handle onto
  // another card = fork; drop on empty space = create a new connected beat.
  let root = $state<HTMLDivElement>();

  const TYPE_C: Record<string, string> = {
    intro: '#6fae86',
    scene: '#7fb0c9',
    social: '#b58fc0',
    combat: '#c86a60',
    reveal: '#6cc0a8',
    terminal: '#c86a60',
  };
  const STATUS_GLYPH: Record<string, string> = { done: '✓', draft: '◐', planned: '○' };

  const g = $derived(planner.graph);

  // viewport transform
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  // drag-to-connect / pan gesture state
  let conn = $state<{ from: string; x: number; y: number } | null>(null);
  let hoverId = $state<string | null>(null);
  let moved = $state(false);
  let pan: { px: number; py: number; ox: number; oy: number } | null = null;

  onMount(() => {
    void tick().then(fit);
  });

  function clampScale(s: number) {
    return Math.min(1.6, Math.max(0.35, s));
  }

  /** Fit the whole graph into the viewport (with a little margin). */
  function fit() {
    if (!root) return;
    const cw = root.clientWidth - 24;
    const ch = root.clientHeight - 24;
    if (cw <= 0 || ch <= 0) return;
    const s = clampScale(Math.min(cw / g.width, ch / g.height, 1));
    scale = s;
    panX = Math.max(12, (root.clientWidth - g.width * s) / 2);
    panY = Math.max(12, (root.clientHeight - g.height * s) / 2);
  }

  /** Client point → canvas coordinates (undo pan + zoom). */
  function toCanvas(clientX: number, clientY: number) {
    const r = root!.getBoundingClientRect();
    return { x: (clientX - r.left - panX) / scale, y: (clientY - r.top - panY) / scale };
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = root!.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const ns = clampScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    panX = cx - (cx - panX) * (ns / scale);
    panY = cy - (cy - panY) * (ns / scale);
    scale = ns;
  }

  function zoomBy(f: number) {
    if (!root) return;
    const cx = root.clientWidth / 2;
    const cy = root.clientHeight / 2;
    const ns = clampScale(scale * f);
    panX = cx - (cx - panX) * (ns / scale);
    panY = cy - (cy - panY) * (ns / scale);
    scale = ns;
  }

  // --- pan (drag empty canvas) ---
  function onCanvasDown(e: PointerEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('.pg-card') || el.closest('.pg-handle')) return; // cards handle their own
    pan = { px: e.clientX, py: e.clientY, ox: panX, oy: panY };
    window.addEventListener('pointermove', onPanMove);
    window.addEventListener('pointerup', onPanUp);
  }
  function onPanMove(e: PointerEvent) {
    if (!pan) return;
    panX = pan.ox + (e.clientX - pan.px);
    panY = pan.oy + (e.clientY - pan.py);
  }
  function onPanUp() {
    pan = null;
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', onPanUp);
  }

  // --- drag-to-connect / drop-to-create ---
  function startConnect(e: PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    conn = { from: id, x: p.x, y: p.y };
    moved = false;
    window.addEventListener('pointermove', onConnMove);
    window.addEventListener('pointerup', onConnUp);
  }
  function onConnMove(e: PointerEvent) {
    if (!conn) return;
    moved = true;
    const p = toCanvas(e.clientX, e.clientY);
    conn = { ...conn, x: p.x, y: p.y };
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const card = el?.closest('[data-beat]') as HTMLElement | null;
    hoverId = card?.dataset.beat ?? null;
  }
  function onConnUp() {
    if (conn && moved) {
      if (hoverId && hoverId !== conn.from) planner.connect(conn.from, hoverId);
      else if (!hoverId) planner.forkToNew(conn.from);
    }
    conn = null;
    hoverId = null;
    window.removeEventListener('pointermove', onConnMove);
    window.removeEventListener('pointerup', onConnUp);
  }

  // ghost placeholder shown while dragging over empty space
  const ghost = $derived(conn && moved && !hoverId ? conn : null);
</script>

<div
  class="pg"
  bind:this={root}
  onwheel={onWheel}
  onpointerdown={onCanvasDown}
  role="application"
  aria-label={t('planner.sessionGraph')}
>
  <div class="pg-view" style:transform="translate({panX}px, {panY}px) scale({scale})">
    <svg class="pg-edges" width={g.width} height={g.height} aria-hidden="true">
      <defs>
        {#each ['seq', 'fork', 'term', 'cursor'] as m (m)}
          <marker
            id="pg-arr-{m}"
            class="pg-arr {m}"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" />
          </marker>
        {/each}
      </defs>
      {#each g.edges as e (e.id)}
        <path
          class="pg-edge {e.kind}"
          class:cursor={e.cursor}
          d={e.d}
          marker-end="url(#pg-arr-{e.cursor ? 'cursor' : e.kind === 'terminal' ? 'term' : e.kind === 'seq' ? 'seq' : 'fork'})"
        />
      {/each}
      {#if conn && moved}
        {@const from = g.nodes.find((n) => n.id === conn?.from)}
        {#if from}
          <path
            class="pg-edge fork cursor pg-temp"
            d="M {from.x + from.w} {from.y + from.h / 2} L {conn.x} {conn.y}"
          />
        {/if}
      {/if}
    </svg>

    {#each g.edges as e (e.id)}
      {#if e.label && e.kind !== 'seq'}
        <span
          class="pg-elabel {e.kind}"
          class:cursor={e.cursor}
          style:left="{e.lx}px"
          style:top="{e.ly}px"
          title={e.label}>{e.label}</span
        >
      {/if}
    {/each}

    {#if ghost}
      <div class="pg-ghost" style:left="{ghost.x}px" style:top="{ghost.y}px">＋ {t('planner.dropToCreate')}</div>
    {/if}

    {#each g.nodes as n (n.id)}
      {#if n.kind === 'terminal'}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="pg-card terminal"
          style:left="{n.x}px"
          style:top="{n.y}px"
          role="button"
          tabindex="-1"
          title={t('planner.promoteHint')}
          onclick={() => n.srcId && planner.select(n.srcId)}
          ondblclick={() => n.srcId && n.branchId && planner.promoteTerminal(n.srcId, n.branchId)}
        >
          <div class="pg-ctop">
            <span class="pg-dot" style:background="var(--red-dim)"></span>
            <span class="pg-type" style:color="var(--red)">{t('planner.terminal')}</span>
            <span class="pg-promote">↗</span>
          </div>
          <div class="pg-title">{n.title}</div>
          <div class="pg-mins">—</div>
        </div>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="pg-card {n.type}"
          class:cur={n.cursor}
          class:sel={n.beatId === planner.selectedId}
          class:opt={n.optional}
          class:drop={hoverId === n.beatId && conn && conn.from !== n.beatId}
          style:left="{n.x}px"
          style:top="{n.y}px"
          style:--pg-c={TYPE_C[n.type] ?? 'var(--faint)'}
          data-beat={n.beatId}
          role="button"
          tabindex="-1"
          aria-label={n.title}
          onclick={() => planner.select(n.beatId!)}
          ondblclick={() => planner.setCurrent(n.beatId!)}
        >
          {#if n.cursor}<span class="pg-here">◆ {t('planner.youAreHere')}</span>{/if}
          <div class="pg-ctop">
            <span class="pg-dot"></span>
            <span class="pg-type">{t('planner.type.' + n.type)}{#if n.optional}<span class="pg-opt"> · {t('planner.opt')}</span>{/if}</span>
            <span class="pg-status {n.status}">{STATUS_GLYPH[n.status ?? 'planned']}</span>
          </div>
          <div class="pg-title">{n.title}</div>
          <div class="pg-cbot">
            {#if n.mins}<span class="pg-mins">{n.mins}m</span>{/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="pg-handle"
              title={t('planner.dragConnect')}
              onpointerdown={(e) => startConnect(e, n.beatId!)}
            ></span>
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <div class="pg-zoom">
    <button title={t('planner.zoomOut')} aria-label={t('planner.zoomOut')} onclick={() => zoomBy(1 / 1.2)}>−</button>
    <button class="pg-fit" title={t('planner.zoomFit')} aria-label={t('planner.zoomFit')} onclick={fit}>⊡</button>
    <button title={t('planner.zoomIn')} aria-label={t('planner.zoomIn')} onclick={() => zoomBy(1.2)}>＋</button>
  </div>
</div>

<style>
  .pg {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 1px 1px, var(--fill-g08) 1px, transparent 0) 0 0 / 22px 22px,
      var(--bg2);
    border: 1px solid var(--line);
    border-radius: var(--r3);
    cursor: grab;
    touch-action: none;
    /* dragging cards / panning must never start a browser text selection */
    user-select: none;
    -webkit-user-select: none;
  }
  .pg:active {
    cursor: grabbing;
  }
  .pg-view {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    /* no will-change: transform — it caches a bitmap that blurs when zoomed in;
       letting the browser re-rasterize keeps card text crisp at every scale. */
  }
  .pg-edges {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }
  /* edges */
  .pg-edge {
    fill: none;
    stroke: var(--line2);
    stroke-width: 1.5;
  }
  .pg-edge.fork {
    stroke: var(--edge-gold);
  }
  .pg-edge.terminal {
    stroke: var(--red-dim);
  }
  .pg-edge.loop {
    stroke: var(--gold);
    stroke-dasharray: 3 4;
  }
  .pg-edge.cursor {
    stroke: var(--green);
    stroke-width: 2;
  }
  .pg-temp {
    stroke-dasharray: 4 4;
  }
  .pg-arr path {
    fill: var(--line2);
  }
  .pg-arr.fork path {
    fill: var(--gold);
  }
  .pg-arr.term path {
    fill: var(--red-dim);
  }
  .pg-arr.cursor path {
    fill: var(--green);
  }
  /* edge labels — opaque so the line never strikes through the text */
  .pg-elabel {
    position: absolute;
    transform: translate(-50%, -50%);
    max-width: 150px;
    padding: 3px 8px;
    border-radius: 999px;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
    background: var(--menu-bg);
    border: 1px solid var(--line2);
    pointer-events: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }
  .pg-elabel.fork,
  .pg-elabel.loop {
    color: var(--gold-hi);
    border-color: var(--edge-gold);
    background: var(--menu-bg);
  }
  .pg-elabel.terminal {
    color: var(--red);
    border-color: var(--red-dim);
    background: var(--menu-bg);
  }
  .pg-elabel.cursor {
    box-shadow: 0 0 10px -2px var(--green);
  }
  /* cards */
  .pg-card {
    position: absolute;
    width: 172px;
    height: 64px;
    box-sizing: border-box;
    padding: 8px 10px 7px;
    border-radius: var(--r3);
    background: var(--panel2);
    border: 1px solid var(--line);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition:
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }
  .pg-card:hover {
    border-color: var(--pg-c, var(--line2));
  }
  .pg-card.sel {
    border-color: var(--focus);
    box-shadow: 0 0 0 1px var(--fill-g14);
  }
  .pg-card.cur {
    border-color: var(--green);
    background: var(--surface3);
    box-shadow: 0 0 22px -6px var(--fill-g22);
  }
  .pg-card.opt {
    border-style: dashed;
    border-color: var(--line2);
  }
  .pg-card.terminal {
    background: var(--surface2);
    border-color: var(--red-dim);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
    cursor: pointer;
  }
  .pg-card.terminal:hover {
    border-color: var(--red);
  }
  .pg-card.drop {
    border-color: var(--green);
    box-shadow: 0 0 0 2px var(--green-dim);
  }
  .pg-here {
    position: absolute;
    top: -9px;
    left: 8px;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.13em;
    padding: 2px 6px;
    border-radius: var(--r1);
    color: var(--ink);
    background: var(--green);
  }
  .pg-ctop {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pg-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--pg-c, var(--faint));
    flex: 0 0 auto;
  }
  .pg-type {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pg-c, var(--muted));
  }
  .pg-opt {
    color: var(--faint);
  }
  .pg-status {
    margin-left: auto;
    font-size: 10px;
    line-height: 1;
    color: var(--faint);
  }
  .pg-status.done {
    color: var(--green-dim);
  }
  .pg-promote {
    margin-left: auto;
    font-size: 10px;
    color: var(--red-dim);
  }
  .pg-card.terminal:hover .pg-promote {
    color: var(--red);
  }
  .pg-title {
    font-family: var(--serif);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--txt);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pg-card.terminal .pg-title {
    color: var(--muted);
  }
  .pg-cbot {
    display: flex;
    align-items: center;
    margin-top: auto;
  }
  .pg-mins {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: var(--faint);
    font-variant-numeric: tabular-nums;
  }
  .pg-handle {
    margin-left: auto;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 1.5px solid var(--line2);
    background: var(--panel);
    cursor: crosshair;
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .pg-card:hover .pg-handle {
    opacity: 1;
  }
  .pg-handle:hover {
    border-color: var(--green);
    background: var(--fill-g22);
  }
  /* drop-to-create ghost */
  .pg-ghost {
    position: absolute;
    transform: translate(-6px, -6px);
    width: 172px;
    height: 64px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border-radius: var(--r3);
    border: 1.5px dashed var(--green);
    background: var(--fill-g08);
    color: var(--green);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    pointer-events: none;
  }
  /* zoom controls */
  .pg-zoom {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    backdrop-filter: blur(3px);
  }
  .pg-zoom button {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--r1);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .pg-zoom button:hover {
    color: var(--green);
    background: var(--fill-g14);
  }
  .pg-zoom .pg-fit {
    font-size: 12px;
  }
</style>
