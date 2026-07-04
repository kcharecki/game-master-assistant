<script lang="ts">
  import { onMount } from 'svelte';
  import { planner } from './store.svelte';
  import { beatCue } from './logic';
  import { renderMarkdown } from '../notebook/logic';
  import { putOnAir } from '../reveal/bus-actions';
  import { toast } from '../../lib/stores/toast.svelte';
  import { t } from '../../lib/i18n';
  import Empty from '../../lib/components/Empty.svelte';
  import FlowMap from './FlowMap.svelte';

  let root = $state<HTMLDivElement>();

  onMount(() => {
    void planner.load();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cueHtml = $derived.by(() => {
    const beat = planner.current;
    if (!beat) return '';
    const cue = (beat.cue ?? '').trim() || beatCue(beat.body);
    return cue ? renderMarkdown(cue, { wikilink: true }) : '';
  });

  // Send the current beat's read-aloud text to the shared broadcast window.
  function broadcast() {
    const beat = planner.current;
    if (!beat || !beat.boxed.trim()) return;
    putOnAir({ kind: 'text', title: beat.title, body: beat.boxed.trim(), theme: 'parchment' });
    toast.show(t('planner.pushed'));
  }

  // Follow a branch: jump to its target beat, or just advance for a terminal.
  function follow(to: string) {
    const target = planner.branchTargetId(to);
    if (target) planner.jumpTo(target);
  }

  // Cockpit keys — active only while focus lives inside this widget (click it
  // first), so they never hijack Space/arrows from other desktop windows.
  function onKey(e: KeyboardEvent) {
    if (!root || !root.contains(document.activeElement)) return;
    const el = e.target as HTMLElement | null;
    if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'ArrowRight') {
      e.preventDefault();
      planner.step(1);
    } else if (k === 'ArrowLeft') {
      e.preventDefault();
      planner.step(-1);
    } else if (/^[1-9]$/.test(k)) {
      const i = Number(k) - 1;
      if (i < planner.beats.length) planner.jumpTo(planner.beats[i].id);
    } else if (k === 'b' || k === 'B') {
      broadcast();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="pr" bind:this={root} tabindex="0" role="group" aria-label={t('planner.run')}>
  {#if planner.current}
    {@const beat = planner.current}
    <div class="pr-head">
      <span class="pr-live"><span class="pr-lampdot"></span>{t('planner.live')}</span>
      <span class="pr-pos">{t('planner.beat')} {planner.cursorPos} / {planner.beats.length}</span>
      {#if beat.act}<span class="pr-act">· {beat.act.split('·')[0].trim()}</span>{/if}
      {#if beat.mins}<span class="pr-mins">{beat.mins}m</span>{/if}
    </div>

    <div class="pr-flowwrap">
      <div class="pr-flowlab">{t('planner.flow')} <span class="pr-synced">◈ {t('planner.synced')}</span></div>
      <FlowMap compact />
    </div>

    <div class="pr-now {beat.type}">
      <div class="pr-nowtop">
        <span class="pr-dot"></span>
        <span class="pr-nowlab">{t('planner.now')}</span>
        <span class="pr-type {beat.type}">{t('planner.type.' + beat.type)}</span>
      </div>
      <h3 class="pr-title">{beat.title}</h3>
      {#if cueHtml}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes input; only our own spans are re-added -->
        <p class="pr-cue">{@html cueHtml}</p>
      {/if}
    </div>

    <button class="pr-cast" disabled={!beat.boxed.trim()} onclick={broadcast}>
      ⤒ {t('planner.broadcast')}
    </button>

    {#if beat.branches.length}
      <div class="pr-blabel">{t('planner.ifPlayers')}</div>
      <div class="pr-branches">
        {#each beat.branches as br (br.id)}
          {@const target = planner.branchTargetId(br.to)}
          {#if target}
            <button class="pr-branch jump" onclick={() => follow(br.to)} title={t('planner.jumpTo')}>
              <span class="pr-glyph">⤳</span>
              <span class="pr-cond">{br.cond}</span>
              <span class="pr-to">→ {br.to}</span>
            </button>
          {:else}
            <div class="pr-branch end">
              <span class="pr-glyph">✦</span>
              <span class="pr-cond">{br.cond}</span>
              <span class="pr-to">→ {br.to}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    {#if planner.next}
      <button class="pr-next" onclick={() => planner.step(1)}>
        <span class="pr-nextlab">{t('planner.next')} →</span>
        <span class="pr-nexttitle">{planner.next.title}</span>
        <span class="pr-type {planner.next.type}">{t('planner.type.' + planner.next.type)}</span>
      </button>
    {/if}

    <div class="pr-nav">
      <button class="pr-nbtn ghost" onclick={() => planner.step(-1)}>◂ {t('planner.prev')}</button>
      <button class="pr-nbtn" onclick={() => planner.step(1)}>{t('planner.next')} ▸</button>
    </div>
    <div class="pr-keys">{t('planner.keysHint')}</div>
  {:else}
    <Empty text={t('beats.none')} icon="edit" />
  {/if}
</div>

<style>
  .pr {
    display: flex;
    flex-direction: column;
    gap: 9px;
    height: 100%;
    overflow: auto;
    outline: none;
  }
  .pr-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-live {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--gold);
    font-weight: 700;
  }
  .pr-lampdot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 8px var(--gold);
  }
  .pr-pos {
    color: var(--muted);
  }
  .pr-act {
    color: var(--faint);
  }
  .pr-mins {
    margin-left: auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .pr-flowwrap {
    border: 1px solid var(--line);
    border-radius: 9px;
    padding: 4px 8px 2px;
    background: rgba(0, 0, 0, 0.18);
  }
  .pr-flowlab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-synced {
    color: var(--green-dim);
    letter-spacing: 0.08em;
  }
  .pr-now {
    border: 1px solid rgba(214, 182, 94, 0.4);
    border-left: 3px solid var(--gold);
    border-radius: 10px;
    padding: 10px 12px;
    background:
      radial-gradient(120% 120% at 0% 0%, rgba(214, 182, 94, 0.12), transparent 60%),
      rgba(214, 182, 94, 0.05);
  }
  .pr-nowtop {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .pr-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 7px var(--gold);
  }
  .pr-nowlab {
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--ptype-c, var(--line2));
    color: var(--ptype-c, var(--muted));
    background: var(--ptype-bg, transparent);
  }
  .pr-nowtop .pr-type {
    margin-left: auto;
  }
  .pr-title {
    margin: 6px 0 0;
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 600;
    color: #f0e7cf;
    line-height: 1.2;
  }
  .pr-cue {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
  .pr-cue :global(p) {
    margin: 0;
  }
  .pr-cue :global(.md-npc) {
    color: #c9a6d4;
  }
  .pr-cue :global(.md-tag) {
    color: var(--green);
  }
  .pr-cue :global(.md-wiki) {
    color: var(--gold);
    text-decoration: none;
  }
  .pr-cast {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .pr-cast:hover:not(:disabled) {
    color: var(--gold);
    border-color: rgba(214, 182, 94, 0.4);
  }
  .pr-cast:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pr-blabel {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 700;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-branches {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .pr-branch {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 11.5px;
    padding: 6px 9px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
  }
  .pr-branch.jump {
    cursor: pointer;
    border-color: var(--green-dim);
  }
  .pr-branch.jump:hover {
    background: rgba(79, 163, 123, 0.15);
  }
  .pr-branch.end {
    opacity: 0.75;
    border-style: dashed;
  }
  .pr-glyph {
    color: var(--green-dim);
  }
  .pr-branch.end .pr-glyph {
    color: var(--gold);
  }
  .pr-cond {
    color: var(--muted);
    font-style: italic;
    flex: 1;
    min-width: 0;
  }
  .pr-to {
    color: var(--green);
    white-space: nowrap;
  }
  .pr-branch.end .pr-to {
    color: var(--muted);
  }
  .pr-next {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    font: inherit;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px dashed var(--line2);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
  }
  .pr-next:hover {
    border-color: var(--green-dim);
  }
  .pr-nextlab {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-nexttitle {
    font-size: 12.5px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pr-nav {
    display: flex;
    gap: 6px;
    margin-top: auto;
    padding-top: 2px;
  }
  .pr-nbtn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--gold);
    background: rgba(214, 182, 94, 0.1);
    color: var(--gold);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  .pr-nbtn:hover {
    background: rgba(214, 182, 94, 0.2);
  }
  .pr-nbtn.ghost {
    flex: 0 0 auto;
    color: var(--muted);
    border-color: var(--line2);
    background: transparent;
    font-weight: 400;
  }
  .pr-nbtn.ghost:hover {
    color: var(--txt);
    background: rgba(95, 150, 120, 0.1);
  }
  .pr-keys {
    text-align: center;
    font-size: 9.5px;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  /* per-type accents (drive .pr-type badge + .pr-now tint via CSS vars) */
  .pr-now.intro,
  .pr-type.intro {
    --ptype-c: #6fae86;
    --ptype-bg: rgba(111, 174, 134, 0.12);
  }
  .pr-now.scene,
  .pr-type.scene {
    --ptype-c: #7fb0c9;
    --ptype-bg: rgba(127, 176, 201, 0.12);
  }
  .pr-now.social,
  .pr-type.social {
    --ptype-c: #b58fc0;
    --ptype-bg: rgba(181, 143, 192, 0.12);
  }
  .pr-now.combat,
  .pr-type.combat {
    --ptype-c: #c86a60;
    --ptype-bg: rgba(200, 106, 96, 0.12);
  }
  .pr-now.reveal,
  .pr-type.reveal {
    --ptype-c: #6cc0a8;
    --ptype-bg: rgba(108, 192, 168, 0.12);
  }
</style>
