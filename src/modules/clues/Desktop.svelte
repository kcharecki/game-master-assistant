<script lang="ts">
  import { clues } from './store.svelte';
  import type { Pin } from './logic';
  import { t } from '../../lib/i18n';

  const PIN_W = 96;
  const PIN_H = 44;

  let selected = $state<string | null>(null);
  let board = $state<HTMLDivElement | null>(null);

  // drag state
  let dragging = $state<string | null>(null);
  let moved = $state(false);
  let offX = 0;
  let offY = 0;

  function centerOf(p: Pin) {
    return { cx: p.x + PIN_W / 2, cy: p.y + PIN_H / 2 };
  }

  function boardXY(e: PointerEvent): { x: number; y: number } {
    const r = board?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  function startDrag(e: PointerEvent, p: Pin) {
    dragging = p.id;
    moved = false;
    const { x, y } = boardXY(e);
    offX = x - p.x;
    offY = y - p.y;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging) return;
    moved = true;
    const { x, y } = boardXY(e);
    clues.move(dragging, Math.max(0, x - offX), Math.max(0, y - offY));
  }

  function endDrag(e: PointerEvent, p: Pin) {
    if (dragging) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragging = null;
    if (moved) return; // a real drag, not a click → don't toggle selection/string
    // click: select, or draw/remove a string to the already-selected pin
    if (selected && selected !== p.id) {
      clues.toggleConnect(selected, p.id);
      selected = null;
    } else {
      selected = selected === p.id ? null : p.id;
    }
  }

  function addClue() {
    clues.add(t('clues.newClue'), 30, 30);
  }
</script>

<div class="cbbar">
  <span class="rnd">{t('clues.redString')}</span>
  <button class="btn sm" onclick={addClue}>{t('clues.addClue')}</button>
</div>
<div class="hint" data-no-drag>
  {t('clues.hintPrefix')} {selected ? t('clues.hintStringCut') : t('clues.hintConnect')}
</div>

<div class="cork" bind:this={board} data-no-drag>
  <svg class="strings">
    {#each clues.connections as c (c.from + c.to)}
      {@const a = clues.pins.find((p) => p.id === c.from)}
      {@const b = clues.pins.find((p) => p.id === c.to)}
      {#if a && b}
        <line x1={centerOf(a).cx} y1={centerOf(a).cy} x2={centerOf(b).cx} y2={centerOf(b).cy} />
      {/if}
    {/each}
  </svg>

  {#each clues.pins as p (p.id)}
    <div
      class="pin"
      class:sel={selected === p.id}
      style="left:{p.x}px; top:{p.y}px; width:{PIN_W}px;"
      onpointerdown={(e) => startDrag(e, p)}
      onpointermove={onMove}
      onpointerup={(e) => endDrag(e, p)}
      role="button"
      tabindex="0"
    >
      <button
        class="px"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={() => clues.remove(p.id)}
        aria-label={t('clues.remove')}>✕</button
      >
      <span class="ptext">{p.text}</span>
    </div>
  {/each}
</div>

<style>
  .cbbar {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .cbbar .btn.sm {
    margin-left: auto;
    padding: 5px 11px;
    font-size: 12px;
  }
  .hint {
    font-size: 11px;
    color: var(--faint);
    margin-bottom: 6px;
  }
  .cork {
    position: relative;
    flex: 1;
    min-height: 160px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(40, 26, 14, 0.35);
    overflow: hidden;
    touch-action: none;
  }
  .strings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .strings line {
    stroke: #b6453c;
    stroke-width: 1.6;
  }
  .pin {
    position: absolute;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid var(--line2);
    background: #efe6cf;
    color: #211c12;
    font-size: 11px;
    line-height: 1.25;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    user-select: none;
  }
  .pin.sel {
    outline: 2px solid var(--gold);
  }
  .pin::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 50%;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    border-radius: 50%;
    background: #b6453c;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .ptext {
    display: block;
    word-break: break-word;
  }
  .px {
    float: right;
    width: 14px;
    height: 14px;
    margin: -2px -2px 0 4px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: #8a3b34;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
  }
  .px:hover {
    background: #b6453c;
    color: #fff;
  }
</style>
