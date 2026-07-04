<script lang="ts">
  import { onMount } from 'svelte';
  import { notebook } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Capture from './Capture.svelte';
  import NoteView from './NoteView.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  onMount(() => void notebook.load());

  let collapsed = $state(false);

  // Live-play stream: pinned band on top, everything else newest-first. Search,
  // tags and sessions live in the Editor — the widget stays a capture surface.
  const pinned = $derived(notebook.visible.filter((n) => n.pinned));
  const rest = $derived(notebook.visible.filter((n) => !n.pinned));
</script>

<div class="nbw">
  <div class="nbw-title">
    <span class="nbw-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="nbw-ttl">{t('notebook.title').toUpperCase()}</span>
    <button
      class="nbw-caret"
      title={collapsed ? t('notebook.expand') : t('notebook.collapse')}
      aria-label={collapsed ? t('notebook.expand') : t('notebook.collapse')}
      onclick={() => (collapsed = !collapsed)}>{collapsed ? '⌃' : '⌄'}</button
    >
  </div>

  <Capture autofocus />

  {#if !collapsed}
    <div class="nbw-stream">
      {#if pinned.length}
        <div class="nbw-band">{t('notebook.pinned')}</div>
        <ul class="nbw-notes">
          {#each pinned as n (n.id)}<NoteView note={n} />{/each}
        </ul>
      {/if}
      {#if rest.length}
        <ul class="nbw-notes">
          {#each rest as n (n.id)}<NoteView note={n} />{/each}
        </ul>
      {:else if !pinned.length}
        <Empty text={t('notebook.noNotes')} icon="edit" />
      {/if}
    </div>
  {/if}
</div>

<style>
  .nbw {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .nbw-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }
  .nbw-dots {
    display: inline-flex;
    gap: 4px;
  }
  .nbw-dots i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--line2);
  }
  .nbw-ttl {
    font-size: 10px;
    letter-spacing: 0.16em;
    color: var(--muted);
  }
  .nbw-caret {
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 2px 4px;
  }
  .nbw-caret:hover {
    color: var(--txt);
  }
  .nbw-stream {
    display: flex;
    flex-direction: column;
    gap: 5px;
    overflow: auto;
    min-height: 0;
  }
  .nbw-band {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold);
    padding: 2px 2px 0;
  }
  .nbw-notes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
</style>
