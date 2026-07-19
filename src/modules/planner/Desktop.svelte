<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { planner } from './store.svelte';
  import { beatCue } from './logic';
  import { renderMarkdown } from '../notebook/logic';
  import { putOnAir } from '../reveal/bus-actions';
  import { openRef } from '../../lib/xref';
  import { toast } from '../../lib/stores/toast.svelte';
  import { t } from '../../lib/i18n';
  import Empty from '../../lib/components/Empty.svelte';
  import FlowMap from './FlowMap.svelte';
  import Icon from '../../lib/components/Icon.svelte';

  let root = $state<HTMLDivElement>();
  let elapsed = $state(0); // seconds since the run cockpit mounted
  let tick: ReturnType<typeof setInterval>;

  onMount(() => {
    void planner.load();
    const start = Date.now();
    tick = setInterval(() => (elapsed = Math.floor((Date.now() - start) / 1000)), 1000);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  onDestroy(() => clearInterval(tick));

  const clock = $derived.by(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  const cueHtml = $derived.by(() => {
    const beat = planner.current;
    if (!beat) return '';
    const cue = (beat.cue ?? '').trim() || beatCue(beat.body);
    return cue ? renderMarkdown(cue, { wikilink: true }) : '';
  });

  // Visited beats → titles, for the TRAIL readout (last few + the cursor).
  const trail = $derived.by(() => {
    const titleOf = (id: string) => planner.beats.find((x) => x.id === id)?.title ?? '';
    const hops = planner.trail.slice(-2).map(titleOf).filter(Boolean);
    const cur = planner.current?.title ?? '';
    return { hops, cur };
  });

  function broadcast() {
    const beat = planner.current;
    if (!beat || !beat.boxed.trim()) return;
    putOnAir({ kind: 'text', title: beat.title, body: beat.boxed.trim(), theme: 'parchment' });
    toast.show(t('planner.pushed'));
  }

  function follow(to: string) {
    const target = planner.branchTargetId(to);
    if (target) planner.jumpTo(target);
  }

  // Delegated click on the cue's rendered refs: [[lore]] links carry data-wiki;
  // @npc mentions are .md-npc spans whose text keeps the leading @. Either way,
  // fire a cross-module open so App.svelte resolves it to a lore page or NPC.
  function onCueClick(e: MouseEvent) {
    const el = e.target as HTMLElement;
    const wiki = el.closest('a[data-wiki]') as HTMLElement | null;
    if (wiki) {
      e.preventDefault();
      openRef(wiki.dataset.wiki ?? '');
      return;
    }
    const npc = el.closest('.md-npc') as HTMLElement | null;
    if (npc) {
      e.preventDefault();
      openRef((npc.textContent ?? '').replace(/^@/, '').trim());
    }
  }

  function targetMins(to: string): number | undefined {
    const id = planner.branchTargetId(to);
    return id ? planner.beats.find((x) => x.id === id)?.mins : undefined;
  }

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
      planner.back();
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
      <span class="pr-run"><span class="pr-lampdot"></span>{t('planner.runTitle')} — {planner.campaign}</span>
      <span class="pr-clock">{clock} · {planner.plannedMins}{t('planner.minsHint')} {t('planner.planned')}</span>
    </div>

    <div class="pr-now {beat.type}">
      <div class="pr-nowtop">
        <span class="pr-nowlab">{t('planner.now')}</span>
        <span class="pr-type {beat.type}">{t('planner.type.' + beat.type)}</span>
        {#if beat.mins}<span class="pr-mins">{beat.mins} {t('planner.minsHint')}</span>{/if}
      </div>
      <h3 class="pr-title">{beat.title}</h3>
      {#if cueHtml}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes input; only our own spans are re-added -->
        <p class="pr-cue" onclick={onCueClick}>{@html cueHtml}</p>
      {/if}
      <div class="pr-nowact">
        <button class="pr-cast" disabled={!beat.boxed.trim()} onclick={broadcast}>
          {t('planner.pushReadAloud')} <Icon name="play" size={14} />
        </button>
        <button class="pr-back" disabled={!planner.canBack} onclick={() => planner.back()}>↩ {t('planner.back')}</button>
      </div>
    </div>

    {#if beat.branches.length}
      <div class="pr-blabel">{t('planner.tableChose')} →</div>
      <div class="pr-branches">
        {#each beat.branches as br (br.id)}
          {@const target = planner.branchTargetId(br.to)}
          {#if target}
            <button class="pr-branch jump" onclick={() => follow(br.to)} title={t('planner.jumpTo')}>
              <span class="pr-cond">→ {br.cond || br.to}</span>
              <span class="pr-to">{br.to}</span>
              {#if targetMins(br.to)}<span class="pr-bmins">{targetMins(br.to)}m</span>{/if}
            </button>
          {:else}
            <div class="pr-branch end">
              <span class="pr-cond">→ {br.cond || br.to}</span>
              <span class="pr-to">{br.to}</span>
              <span class="pr-bmins">—</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    {#if planner.next}
      <button class="pr-next" onclick={() => planner.step(1)}>
        <span class="pr-nextlab">{t('planner.nextLikeliest')}</span>
        <span class="pr-nexttitle">{planner.next.title}</span>
      </button>
    {/if}

    <div class="pr-mapsec">
      <div class="pr-maplab">
        <span>{t('planner.mapJump')}</span>
        <span class="pr-trail">{t('planner.trail')}</span>
      </div>
      <FlowMap compact />
      <div class="pr-trailrow">
        {#each trail.hops as h (h)}<span class="pr-th">{h}</span><span class="pr-tarr">→</span>{/each}
        <span class="pr-th cur">◆ {trail.cur}</span>
      </div>
    </div>

    <div class="pr-threads">
      <div class="pr-thlab">
        <span>{t('planner.threads')}</span>
        <span class="pr-ttally">{planner.tally.open} {t('quests.open')} / {planner.tally.resolved} {t('quests.resolved')}</span>
      </div>
      {#each planner.threads as thr (thr.id)}
        <div class="pr-thr">
          <button
            class="pr-tcheck"
            class:res={thr.resolved}
            aria-label={thr.resolved ? t('quests.reopen') : t('quests.resolve')}
            onclick={() => planner.toggleThread(thr.id)}>{thr.resolved ? '✓' : '○'}</button
          >
          <span class="pr-ttext" class:struck={thr.resolved}>{thr.text}</span>
          {#if thr.planted}<span class="pr-tmeta">{thr.planted}</span>{/if}
        </div>
      {/each}
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
    gap: 10px;
    height: 100%;
    overflow: auto;
    outline: none;
  }
  .pr-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-run {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    letter-spacing: 0.16em;
  }
  .pr-lampdot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
  }
  .pr-clock {
    color: var(--faint);
    font-variant-numeric: tabular-nums;
  }
  .pr-now {
    border: 1px solid var(--line3);
    border-left: 3px solid var(--green);
    border-radius: var(--r3);
    padding: 10px 12px;
    background:
      radial-gradient(120% 120% at 0% 0%, var(--fill-g14), transparent 60%),
      var(--fill-g08);
  }
  .pr-nowtop {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pr-nowlab {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--green);
    font-weight: 600;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 9px;
    border-radius: 999px;
    color: var(--ptype-c, var(--muted));
    background: var(--ptype-bg, transparent);
  }
  .pr-mins {
    margin-left: auto;
    color: var(--muted);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-variant-numeric: tabular-nums;
  }
  .pr-title {
    margin: 6px 0 0;
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 600;
    color: var(--txt);
    line-height: 1.2;
  }
  .pr-cue {
    margin: 5px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
  .pr-cue :global(p) {
    margin: 0;
  }
  .pr-cue :global(.md-npc) {
    color: #c9a6d4;
    cursor: pointer;
  }
  .pr-cue :global(.md-tag) {
    color: var(--green);
  }
  .pr-cue :global(.md-wiki) {
    color: var(--gold);
    text-decoration: none;
    cursor: pointer;
  }
  .pr-nowact {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
  }
  .pr-cast {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--green);
    background: var(--fill-g14);
    color: var(--green);
    cursor: pointer;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .pr-cast:hover:not(:disabled) {
    background: var(--fill-g22);
  }
  .pr-cast:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pr-back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .pr-back:hover:not(:disabled) {
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .pr-back:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .pr-blabel {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 600;
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
    gap: 8px;
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 11.5px;
    padding: 7px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
  }
  .pr-branch.jump {
    cursor: pointer;
    border-color: var(--line3);
  }
  .pr-branch.jump:hover {
    background: var(--fill-g14);
  }
  .pr-branch.end {
    opacity: 0.7;
    border-style: dashed;
    border-color: var(--red-dim);
  }
  .pr-cond {
    color: var(--green);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 46%;
  }
  .pr-branch.end .pr-cond {
    color: var(--red);
  }
  .pr-to {
    flex: 1;
    min-width: 0;
    color: var(--txt);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pr-bmins {
    color: var(--faint);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
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
  .pr-mapsec,
  .pr-threads {
    border: 1px solid var(--line);
    border-radius: var(--r3);
    padding: 8px 10px;
    background: var(--bg1);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pr-maplab,
  .pr-thlab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pr-trail,
  .pr-ttally {
    color: var(--muted);
    letter-spacing: 0.08em;
  }
  .pr-trailrow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    font-size: 10px;
    color: var(--muted);
  }
  .pr-th {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 40%;
  }
  .pr-th.cur {
    color: var(--green);
  }
  .pr-tarr {
    color: var(--faint);
  }
  .pr-thr {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pr-tcheck {
    border: none;
    background: transparent;
    color: var(--gold);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 0;
  }
  .pr-tcheck.res {
    color: var(--green-dim);
  }
  .pr-ttext {
    flex: 1;
    font-size: 11.5px;
    min-width: 0;
  }
  .pr-ttext.struck {
    color: var(--muted);
    text-decoration: line-through;
  }
  .pr-tmeta {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    white-space: nowrap;
  }
  .pr-keys {
    text-align: center;
    font-size: 9px;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  /* per-type accents */
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
