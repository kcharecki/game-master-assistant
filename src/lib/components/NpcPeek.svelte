<script lang="ts">
  import { onMount } from 'svelte';
  import { npcs, type Npc } from '../../modules/npcs/store.svelte';
  import { spellLibrary } from '../../modules/npcs/spells.svelte';
  import NpcCard from './NpcCard.svelte';
  import Icon from './Icon.svelte';
  import { t } from '../i18n';

  // A GM-only floating cheatsheet for an NPC: hover an anchor to peek, click the
  // pin to keep it open. Reads the FULL npc record (gmNotes/inventory) — pure DOM
  // overlay, never broadcast. Reused by the Stage board and the NPC roster widget.
  // `onPickImage` (optional) enables the broadcast-image picker inside the card.
  let { onPickImage }: { onPickImage?: (assetId: string, npcId: string) => void } = $props();

  let npcId = $state<string | null>(null);
  let pinned = $state(false);
  let x = $state(0);
  let y = $state(0);
  let maxH = $state(0);
  let el = $state<HTMLDivElement | null>(null);
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  const PEEK_W = 320;

  const npc = $derived<Npc | null>(npcId ? (npcs.list.find((n) => n.id === npcId) ?? null) : null);

  function clearTimers() {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    openTimer = closeTimer = null;
  }
  function open(anchor: HTMLElement, id: string) {
    if (!npcs.list.some((n) => n.id === id)) return;
    const r = anchor.getBoundingClientRect();
    const m = 2; // tiny gap so the cursor can cross anchor→card without a dead zone
    let px = r.right + m;
    if (px + PEEK_W > window.innerWidth) px = r.left - PEEK_W - m; // flip to the left
    x = Math.max(m, px);
    // Reserve space for the bottom dock bar so a tall card never hides under it.
    const dock = 108;
    maxH = Math.min(window.innerHeight * 0.7, window.innerHeight - 2 * m - dock);
    y = Math.min(Math.max(m, r.top), window.innerHeight - maxH - m - dock);
    if (id !== npcId) pinned = false; // fresh hover starts unpinned
    npcId = id;
    // A transformed ancestor makes position:fixed resolve against that box, not
    // the viewport — so `top` can render offset. Measure after paint and pull the
    // card up / shrink it so its real bottom clears the dock.
    requestAnimationFrame(() => {
      if (!el || npcId !== id) return;
      const offY = el.getBoundingClientRect().top - y; // ancestor→viewport offset
      const available = window.innerHeight - dock - m - offY; // usable bottom, card coords
      const h = Math.max(160, Math.min(maxH, available - m));
      y = Math.min(y, Math.max(m, available - h));
      maxH = h;
    });
  }

  /** Start the hover-delay timer to open the peek for `id`, anchored to `anchor`. */
  export function schedule(anchor: HTMLElement, id: string) {
    clearTimers();
    openTimer = setTimeout(() => open(anchor, id), 350);
  }
  /** Close after a short grace (so the cursor can travel onto the card). */
  export function scheduleClose() {
    if (openTimer) clearTimeout(openTimer);
    openTimer = null;
    if (pinned) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => (npcId = null), 260);
  }
  /** Cancel any pending open and close now unless pinned (e.g. a drag started). */
  export function cancel() {
    clearTimers();
    if (!pinned) npcId = null;
  }
  function keep() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
  }
  function close() {
    clearTimers();
    pinned = false;
    npcId = null;
  }

  onMount(() => {
    void spellLibrary.load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && npcId) {
        e.preventDefault();
        close();
      }
    };
    // A pinned peek dismisses on any click outside it.
    const onDocDown = (e: PointerEvent) => {
      if (pinned && el && !el.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocDown, true);
      clearTimers();
    };
  });
</script>

{#if npc}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="peek"
    class:pinned
    bind:this={el}
    style="left:{x}px; top:{y}px; width:{PEEK_W}px; max-height:{maxH}px"
    onpointerenter={keep}
    onpointerleave={scheduleClose}
  >
    <div class="peekbar">
      <span class="gmtag">{t('stage.gmOnly')}</span>
      <button
        class="peekbtn"
        class:on={pinned}
        onclick={() => (pinned = !pinned)}
        aria-label={pinned ? t('stage.peekUnpin') : t('stage.peekPin')}
        title={pinned ? t('stage.peekUnpin') : t('stage.peekPin')}
      ><Icon name="pin" size={13} /></button>
      <button
        class="peekbtn"
        onclick={close}
        aria-label={t('stage.peekClose')}
        title={t('stage.peekClose')}
      ><Icon name="close" size={13} /></button>
    </div>
    <NpcCard {npc} onPickImage={onPickImage ? (aid) => onPickImage(aid, npc.id) : undefined} />
  </div>
{/if}

<style>
  .peek {
    position: fixed;
    z-index: 10000;
    max-height: 70vh;
    overflow-y: auto;
    border-radius: 12px;
    animation: peekin 0.12s ease-out;
  }
  .peek.pinned {
    box-shadow: 0 0 0 1px var(--gold, #c7a44e), 0 14px 40px rgba(0, 0, 0, 0.6);
  }
  @keyframes peekin {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .peekbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: rgba(9, 16, 13, 0.92);
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 12px 12px 0 0;
  }
  .gmtag {
    flex: 1;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #d98c7a;
  }
  .peekbtn {
    display: grid;
    place-items: center;
    width: 22px;
    height: 20px;
    border: 1px solid var(--line2);
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .peekbtn:hover {
    color: var(--txt);
    background: rgba(47, 138, 102, 0.18);
  }
  .peekbtn.on {
    color: var(--gold, #c7a44e);
    border-color: var(--gold, #c7a44e);
    background: rgba(199, 164, 78, 0.18);
  }
</style>
