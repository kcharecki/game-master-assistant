<script lang="ts">
  import { onMount } from 'svelte';
  import { handouts } from './store.svelte';
  import { t } from '../../lib/i18n';

  onMount(() => void handouts.load());

  let selectedId = $state<string | null>(null);
  const selected = $derived(handouts.list.find((h) => h.id === selectedId) ?? null);

  function add() {
    selectedId = handouts.add().id;
  }

  function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file && selected) void handouts.attachImage(selected.id, file);
  }
</script>

<div class="ho">
  <div class="list">
    {#each handouts.list as h (h.id)}
      <button class="row" class:on={h.id === selectedId} onclick={() => (selectedId = h.id)}>
        <span class="t">{h.title || t('handouts.untitled')}</span>
        {#if h.assetId}<span class="img">{t('handouts.img')}</span>{/if}
      </button>
    {:else}
      <p class="muted">{t('handouts.none')}</p>
    {/each}
    <button class="btn add" onclick={add}>{t('handouts.new')}</button>
  </div>

  {#if selected}
    <div class="edit">
      <input
        class="in"
        value={selected.title}
        oninput={(e) => handouts.update(selected.id, { title: (e.currentTarget as HTMLInputElement).value })}
        placeholder={t('handouts.titlePlaceholder')}
      />
      <textarea
        class="in body"
        value={selected.body}
        oninput={(e) => handouts.update(selected.id, { body: (e.currentTarget as HTMLTextAreaElement).value })}
        placeholder={t('handouts.bodyPlaceholder')}
      ></textarea>
      <div class="actions">
        <label class="btn file">
          {t('handouts.image')}
          <input type="file" accept="image/*" onchange={onFile} />
        </label>
        <button class="btn send" onclick={() => handouts.send(selected.id)}>{t('handouts.send')}</button>
        <button class="btn del" onclick={() => { handouts.remove(selected.id); selectedId = null; }}>
          {t('handouts.delete')}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .ho {
    display: flex;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .list {
    flex: 0 0 38%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.18);
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font-size: 12px;
  }
  .row.on {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.14);
  }
  .img {
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .edit {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .in {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .body {
    flex: 1;
    resize: none;
    font-size: 13px;
    line-height: 1.4;
  }
  .actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .btn {
    padding: 6px 10px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .btn.add {
    margin-top: 4px;
  }
  .file {
    position: relative;
    overflow: hidden;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .send {
    border-color: var(--green);
    color: var(--txt);
    background: rgba(47, 138, 102, 0.22);
  }
  .del {
    border-color: var(--line2);
    color: var(--muted);
    background: transparent;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
</style>
