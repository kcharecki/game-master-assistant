<script lang="ts">
  import { onMount } from 'svelte';
  import { notebook } from './store.svelte';
  import { activeNotes, relativeShort, sessionGapHours, escapeHtml, type Note } from './logic';
  import { t } from '../../lib/i18n';
  import Capture from './Capture.svelte';
  import NoteView from './NoteView.svelte';
  import Icon from '../../lib/components/Icon.svelte';

  onMount(() => void notebook.load());

  let renameTo = $state<Record<string, string>>({});

  const groups = $derived(notebook.sessions);
  const focused = $derived(notebook.focused);

  // tag → count across active notes (for the tag-management panel).
  const tagCounts = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const n of activeNotes($state.snapshot(notebook.notes)))
      for (const tag of n.tags) m[tag] = (m[tag] ?? 0) + 1;
    return m;
  });
  const totalActive = $derived(activeNotes($state.snapshot(notebook.notes)).length);

  // First meaningful line of a note, with @npc / #tag / [[link]] gold-tokenised -
  // the timeline row's title.
  function rowHtml(body: string): string {
    const line = (body.split('\n').find((x) => x.trim()) ?? '').replace(/^#{1,6}\s*/, '').trim() || '—';
    let s = escapeHtml(line);
    s = s.replace(/\[\[([^\][]+)\]\]/g, '<span class="nbe-k">[[$1]]</span>');
    s = s.replace(/(^|\s)(@[a-z0-9][a-z0-9_'-]*)/gi, '$1<span class="nbe-k">$2</span>');
    s = s.replace(/(^|\s)(#[a-z0-9][a-z0-9_-]*)/gi, '$1<span class="nbe-k">$2</span>');
    return s;
  }
  function sessionWhen(startAt: number): string {
    const days = Math.floor((Date.now() - startAt) / 86_400_000);
    return days <= 0 ? t('notebook.tonight') : `${days}d`;
  }
  function maxRound(notes: Note[]): number | undefined {
    const rs = notes.map((n) => n.ctx?.round).filter((r): r is number => !!r);
    return rs.length ? Math.max(...rs) : undefined;
  }

  function doRename(tag: string, to?: string) {
    const dest = (to ?? renameTo[tag] ?? '').trim();
    if (!dest) return;
    notebook.renameTag(tag, dest);
    renameTo[tag] = '';
  }
</script>

<div class="nbe">
  <!-- LEFT: capture + search + session-grouped timeline -->
  <div class="nbe-left">
    <div class="nbe-title">
      <span class="nbe-ttl">{t('notebook.title').toUpperCase()}</span>
      <span class="nbe-sub">· {t('notebook.editorTag')}</span>
    </div>

    <Capture variant="bar" />

    <div class="nbe-find">
      <span class="nbe-mag">⌕</span>
      <input class="nbe-search" placeholder={t('notebook.search')} bind:value={notebook.query} />
      {#if notebook.query.trim()}
        <span class="nbe-mcount"
          >{notebook.visible.length}
          {notebook.visible.length === 1 ? t('notebook.matchPre') : t('notebook.matchesPre')}</span
        >
      {/if}
      {#if notebook.activeTag}
        <button class="nbe-fchip" onclick={() => notebook.setTag(notebook.activeTag)}
          >#{notebook.activeTag} <Icon name="close" size={14} /></button
        >
      {/if}
    </div>

    <div class="nbe-timeline">
      {#each groups as group, gi (group.index)}
        {@const round = maxRound(group.notes)}
        <div class="nbe-shead">
          <span class="nbe-snum">{t('notebook.session')} {group.index}</span>
          <span class="nbe-smeta">· {sessionWhen(group.startAt)}{round ? ` · R${round}` : ''}</span>
        </div>
        <ul class="nbe-rows">
          {#each group.notes as n (n.id)}
            <li>
              <button
                class="nbe-row"
                class:active={focused?.id === n.id}
                class:pinned={n.pinned}
                onclick={() => notebook.focus(n.id)}
              >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- escapeHtml runs first; only our own token spans are re-added -->
                <span class="nbe-rbody">{@html rowHtml(n.body)}</span>
                <span class="nbe-rstamp"
                  >{#if n.ctx?.round}R{n.ctx.round} · {/if}{#if n.ctx?.onAir}{t('notebook.onAir')}: {n.ctx.onAir} · {/if}{relativeShort(n.at)}</span
                >
              </button>
            </li>
          {/each}
        </ul>
        {#if sessionGapHours(groups, gi) !== null}
          <div class="nbe-gap">
            {sessionGapHours(groups, gi)}h {t('notebook.gapPre')} {t('notebook.newSession')}
          </div>
        {/if}
      {:else}
        <p class="nbe-muted">{t('notebook.noNotes')}</p>
      {/each}
    </div>
  </div>

  <!-- RIGHT: focused note + context + tags + recap -->
  <aside class="nbe-right">
    {#if focused}
      <ul class="nbe-focuswrap"><NoteView note={focused} focused /></ul>

      <section class="nbe-card">
        <div class="nbe-chdr">{t('notebook.context')}</div>
        <div class="nbe-crow">
          {focused.ctx?.round ? `${t('notebook.round')} ${focused.ctx.round}` : t('notebook.betweenSessions')}
        </div>
        {#if focused.ctx?.ivDate}<div class="nbe-crow">◐ {focused.ctx.ivDate}</div>{/if}
        <div class="nbe-crow">
          {t('notebook.broadcastLabel')}: {focused.ctx?.onAir ?? t('notebook.broadcastOff')}
        </div>
        {#if focused.tags.length}
          <div class="nbe-ctags">
            {#each focused.tags as tag (tag)}<span class="nbe-ctag">#{tag}</span>{/each}
          </div>
        {/if}
      </section>
    {:else}
      <p class="nbe-muted nbe-pad">{t('notebook.selectNote')}</p>
    {/if}

    <section class="nbe-card">
      <div class="nbe-chdr">{t('notebook.allTags')}</div>
      <div class="nbe-tsum">
        {notebook.tags.length} {t('notebook.tagsPre')} · {totalActive} {t('notebook.notesPre')}
      </div>
      {#if notebook.tags.length}
        <ul class="nbe-taglist">
          {#each notebook.tags as tag (tag)}
            <li class="nbe-tagrow">
              <button
                class="nbe-chip"
                class:on={notebook.activeTag === tag}
                onclick={() => notebook.setTag(tag)}>#{tag} <span class="nbe-tc">{tagCounts[tag] ?? 0}</span></button
              >
              <input
                class="nbe-tin"
                placeholder={t('notebook.renameTo')}
                value={renameTo[tag] ?? ''}
                oninput={(e) => (renameTo[tag] = (e.currentTarget as HTMLInputElement).value)}
                onkeydown={(e) => e.key === 'Enter' && doRename(tag)}
              />
              <select
                class="nbe-tmerge"
                aria-label={t('notebook.mergeInto')}
                onchange={(e) => {
                  const v = (e.currentTarget as HTMLSelectElement).value;
                  if (v) doRename(tag, v);
                  (e.currentTarget as HTMLSelectElement).value = '';
                }}
              >
                <option value="">{t('notebook.mergeInto')}</option>
                {#each notebook.tags.filter((x) => x !== tag) as other (other)}
                  <option value={other}>#{other}</option>
                {/each}
              </select>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="nbe-muted">{t('notebook.noNotes')}</p>
      {/if}
    </section>

    <section class="nbe-card">
      <div class="nbe-chdr">{t('notebook.prevOn')}</div>
      {#if notebook.recap}
        <pre class="nbe-rtext">{notebook.recap}</pre>
        <div class="nbe-rmeta">{t('notebook.recapFrom')} {totalActive} {t('notebook.recapNotes')}</div>
        <div class="nbe-racts">
          <button class="nbe-btn sm" onclick={() => navigator.clipboard.writeText(notebook.recap ?? '')}><Icon name="duplicate" size={14} /> {t('notebook.copy')}</button>
          <button class="nbe-btn sm solid" onclick={() => notebook.pushRecapToBroadcast()}><Icon name="play" size={14} /> {t('notebook.pushCaption')}</button>
          <button class="nbe-btn sm ghost" onclick={() => (notebook.recap = null)}>{t('notebook.dismiss')}</button>
        </div>
      {:else}
        <button class="nbe-btn gen" onclick={() => notebook.makeRecap()}><Icon name="spotlight" size={14} /> {t('notebook.generateRecap')}</button>
      {/if}
    </section>
  </aside>
</div>

<style>
  .nbe {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 18px;
    padding: 20px 24px;
    align-items: start;
  }
  .nbe-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .nbe-title {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .nbe-ttl {
    font-size: 11px;
    letter-spacing: 0.16em;
    color: var(--txt);
  }
  .nbe-sub {
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--muted);
  }

  .nbe-find {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
  }
  .nbe-find:focus-within {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--fill-gold);
  }
  .nbe-mag {
    color: var(--muted);
  }
  .nbe-search {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--txt);
    font: inherit;
    outline: none;
  }
  .nbe-mcount {
    color: var(--gold);
    font-size: 11px;
    white-space: nowrap;
  }
  .nbe-fchip {
    padding: 2px 8px;
    border-radius: var(--r-pill);
    border: 1px solid var(--gold);
    background: var(--fill-gold);
    color: var(--gold);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .nbe-timeline {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .nbe-shead {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 2px 2px;
  }
  .nbe-snum {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .nbe-smeta {
    font-size: 10px;
    color: var(--muted);
    font-family: ui-monospace, monospace;
  }
  .nbe-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .nbe-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-left: 2px solid transparent;
    border-radius: var(--r2);
    background: var(--fill-g08);
    color: var(--txt);
    font: inherit;
    cursor: pointer;
  }
  .nbe-row:hover {
    border-color: var(--line1);
  }
  .nbe-row.pinned {
    border-left-color: var(--gold);
  }
  .nbe-row.active {
    border-color: var(--gold);
    border-left-color: var(--gold);
    background: var(--fill-gold);
  }
  .nbe-rbody {
    flex: 1;
    min-width: 0;
    font-family: var(--serif);
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nbe-rbody :global(.nbe-k) {
    color: var(--gold);
  }
  .nbe-rstamp {
    color: var(--faint);
    font-family: ui-monospace, monospace;
    font-size: 9px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .nbe-gap {
    align-self: center;
    color: var(--faint);
    font-family: ui-monospace, monospace;
    font-size: 9px;
    letter-spacing: 0.08em;
    padding: 3px 0;
    text-transform: uppercase;
  }

  .nbe-right {
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: sticky;
    top: 20px;
  }
  .nbe-focuswrap {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .nbe-card {
    border: 1px solid var(--line2);
    border-radius: var(--r3);
    padding: 12px;
    background: var(--surface1);
  }
  .nbe-chdr {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .nbe-crow {
    font-size: 12px;
    color: var(--txt);
    margin-bottom: 3px;
  }
  .nbe-ctags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .nbe-ctag {
    color: var(--green);
    font-size: 11px;
  }
  .nbe-tsum {
    font-size: 11px;
    color: var(--faint);
    margin-bottom: 8px;
  }
  .nbe-taglist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .nbe-tagrow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .nbe-chip {
    flex: 0 0 auto;
    padding: 3px 8px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }
  .nbe-chip.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .nbe-tc {
    color: var(--faint);
  }
  .nbe-tin {
    flex: 1;
    min-width: 0;
    padding: 3px 6px;
    font-size: 11px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font-family: inherit;
  }
  .nbe-tmerge {
    flex: 0 0 auto;
    max-width: 92px;
    padding: 3px 4px;
    font-size: 11px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
    font-family: inherit;
  }
  .nbe-rtext {
    margin: 0 0 6px;
    font: inherit;
    font-size: 12px;
    line-height: 1.55;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .nbe-rmeta {
    font-size: 10px;
    color: var(--faint);
    margin-bottom: 8px;
  }
  .nbe-racts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .nbe-btn {
    padding: 8px 14px;
    border-radius: var(--r2);
    border: 1px solid var(--green-dim);
    background: var(--surface2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
  .nbe-btn.gen {
    width: 100%;
    text-align: center;
  }
  .nbe-btn.sm {
    padding: 5px 10px;
    font-size: 12px;
  }
  .nbe-btn.sm.solid {
    background: var(--fill-g22);
  }
  .nbe-btn.sm.ghost {
    color: var(--muted);
    border-color: var(--line2);
  }
  .nbe-muted {
    color: var(--muted);
    font-size: 12px;
  }
  .nbe-pad {
    padding: 8px 2px;
  }
</style>
