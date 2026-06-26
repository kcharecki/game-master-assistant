<script lang="ts">
  import { onMount } from 'svelte';
  import { map, GRID_SIZE, snapToCell, type Token } from './store.svelte';

  let selected = $state<string | null>(null);
  let dragId: string | null = null;
  // Where the pointer grabbed the token, in cell units, so dragging feels anchored.
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  onMount(() => {
    void map.load();
  });

  // Convert a client-space pointer to map-cell coordinates given current transform.
  function toCell(svg: SVGSVGElement, clientX: number, clientY: number) {
    const r = svg.getBoundingClientRect();
    const { panX, panY, zoom } = map.transform;
    const px = (clientX - r.left - panX) / zoom;
    const py = (clientY - r.top - panY) / zoom;
    return { gx: snapToCell(px), gy: snapToCell(py) };
  }

  function onTokenDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragId = id;
    selected = id;
  }

  function onMove(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    if (dragId) {
      const { gx, gy } = toCell(svg, e.clientX, e.clientY);
      map.moveToken(dragId, gx, gy);
    } else if (panning) {
      map.pan(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function onCanvasDown(e: PointerEvent) {
    panning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    selected = null;
  }

  function onUp() {
    dragId = null;
    panning = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    map.zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
  }

  const sel = $derived(map.tokens.find((t) => t.id === selected) ?? null);
  function damage(t: Token, n: number) {
    map.setHp(t.id, t.hp + n);
  }
</script>

<div class="map-wrap" data-no-drag>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    class="canvas"
    aria-label="Battle map"
    onpointerdown={onCanvasDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointerleave={onUp}
    onwheel={onWheel}
  >
    <g transform="translate({map.transform.panX} {map.transform.panY}) scale({map.transform.zoom})">
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path
            d="M {GRID_SIZE} 0 L 0 0 0 {GRID_SIZE}"
            fill="none"
            stroke="rgba(95,150,120,.18)"
            stroke-width="1"
          />
        </pattern>
      </defs>
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid)" />

      {#each map.tokens as t (t.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="tok"
          class:sel={t.id === selected}
          transform="translate({t.gx * GRID_SIZE} {t.gy * GRID_SIZE})"
          onpointerdown={(e) => onTokenDown(e, t.id)}
        >
          <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={GRID_SIZE / 2 - 4} fill={t.color} />
          <text x={GRID_SIZE / 2} y={GRID_SIZE / 2 + 4} text-anchor="middle" class="lbl">
            {t.label}
          </text>
          {#if t.conditions.length}
            <circle cx={GRID_SIZE - 8} cy="8" r="5" fill="var(--gold)" />
          {/if}
        </g>
      {/each}
    </g>
  </svg>

  <div class="toolbar">
    <button class="btn sm" onclick={() => map.addToken(snapToCell(-map.transform.panX), 0, 'New')}>
      + Token
    </button>
    <button class="btn sm" onclick={() => map.zoomBy(1.1)}>＋</button>
    <button class="btn sm" onclick={() => map.zoomBy(0.9)}>－</button>
  </div>

  {#if sel}
    <div class="inspect">
      <strong>{sel.label}</strong>
      <span class="hp">{sel.hp}/{sel.maxHp}</span>
      <button class="btn sm" onclick={() => damage(sel, -1)}>−1</button>
      <button class="btn sm" onclick={() => damage(sel, 1)}>+1</button>
      <button
        class="btn sm"
        class:on={sel.conditions.includes('prone')}
        onclick={() => map.toggleCondition(sel.id, 'prone')}>prone</button
      >
      <button class="btn sm danger" onclick={() => map.removeToken(sel.id)}>✕</button>
    </div>
  {/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 240px;
    overflow: hidden;
    border-radius: 8px;
    background: #07100c;
  }
  .canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .tok {
    cursor: move;
  }
  .tok.sel circle {
    stroke: var(--green);
    stroke-width: 2;
  }
  .lbl {
    fill: #06120c;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
  }
  .toolbar {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 5px;
  }
  .inspect {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    background: rgba(9, 16, 13, 0.85);
    border: 1px solid var(--line2);
    font-size: 12px;
    color: var(--txt);
  }
  .inspect .hp {
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .btn.sm {
    padding: 4px 9px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm.on {
    background: rgba(199, 164, 78, 0.2);
    border-color: var(--gold);
  }
  .btn.sm.danger:hover {
    border-color: var(--red);
    color: var(--red);
  }
</style>
