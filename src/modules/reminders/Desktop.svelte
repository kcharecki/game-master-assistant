<script lang="ts">
  import { onMount } from 'svelte';
  import { reminders } from './store.svelte';
  import { t } from '../../lib/i18n';

  onMount(() => void reminders.load());
</script>

<div class="rm">
  <div class="count">
    <span class="muted">{t('reminders.initiativeCount')}</span>
    <input class="num" type="number" bind:value={reminders.current} />
  </div>

  {#if reminders.due.length}
    <div class="due">
      <div class="dlabel">{t('reminders.dueNow')}</div>
      {#each reminders.due as r (r.id)}
        <div class="ditem">⚡ {r.label}</div>
      {/each}
    </div>
  {/if}

  <ul class="list">
    {#each reminders.sorted as r (r.id)}
      <li class="row">
        <input
          class="lbl"
          value={r.label}
          oninput={(e) => reminders.update(r.id, { label: (e.currentTarget as HTMLInputElement).value })}
        />
        <input
          class="at"
          type="number"
          value={r.count}
          oninput={(e) => reminders.update(r.id, { count: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
        />
        <button class="del" aria-label={t('reminders.remove')} onclick={() => reminders.remove(r.id)}>×</button>
      </li>
    {:else}
      <li class="muted">{t('reminders.empty')}</li>
    {/each}
  </ul>

  <button class="btn" onclick={() => reminders.add()}>{t('reminders.add')}</button>
</div>

<style>
  .rm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .count {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .num {
    width: 56px;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .due {
    border: 1px solid var(--green-dim);
    border-radius: 8px;
    background: rgba(47, 138, 102, 0.12);
    padding: 6px 8px;
  }
  .dlabel {
    color: var(--green);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .ditem {
    font-size: 13px;
    color: var(--txt);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    flex: 1;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lbl {
    flex: 1;
    min-width: 0;
    padding: 5px 7px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .at {
    width: 48px;
    padding: 5px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .del {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
  }
  .del:hover {
    color: var(--txt);
  }
  .btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
