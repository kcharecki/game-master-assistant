<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { timer, formatClock } from './store.svelte';
  import { t } from '../../lib/i18n';

  let handle: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    handle = setInterval(() => timer.tick(1), 1000);
  });
  onDestroy(() => {
    if (handle) clearInterval(handle);
  });
</script>

<div class="diebox">
  <div class="dt">{t('timer.session')}</div>
  <div class="dn" class:over={timer.overBudget}>{formatClock(timer.elapsed)}</div>
  {#if timer.sceneBudget > 0}
    <div class="bar"><span style="width:{timer.budgetFraction * 100}%"></span></div>
    <div class="ds">{t('timer.sceneBudget')} {formatClock(timer.sceneBudget)}</div>
  {/if}
</div>

{#if timer.breakDue}
  <div class="brk" data-no-drag>
    {t('timer.breakSuggested')}
    <button class="ob" onclick={() => timer.ackBreak()}>{t('timer.dismiss')}</button>
  </div>
{/if}

<div class="row">
  {#if timer.running}
    <button class="btn sm" onclick={() => timer.pause()}>{t('timer.pause')}</button>
  {:else}
    <button class="btn solid sm" onclick={() => timer.start()}>{t('timer.start')}</button>
  {/if}
  <button class="btn sm" onclick={() => timer.reset()}>{t('timer.reset')}</button>
</div>

<div class="opts" data-no-drag>
  <label
    >{t('timer.sceneMin')}
    <input
      class="in"
      type="number"
      min="0"
      value={timer.sceneBudget / 60}
      oninput={(e) => (timer.sceneBudget = Number(e.currentTarget.value) * 60)}
    />
  </label>
  <label
    >{t('timer.breakMin')}
    <input class="in" type="number" min="0" bind:value={timer.breakEvery} />
  </label>
</div>

<style>
  .dn.over {
    color: var(--red);
  }
  .bar {
    height: 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.35);
    margin: 8px 12px 4px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--green-dim), var(--green));
  }
  .brk {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--gold);
    margin: 4px 0 10px;
    padding: 6px 9px;
    border-radius: 8px;
    background: rgba(199, 164, 78, 0.1);
    border: 1px solid rgba(199, 164, 78, 0.3);
  }
  .brk .ob {
    margin-left: auto;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font-size: 11px;
  }
  .btn.sm {
    flex: 1;
    justify-content: center;
    padding: 6px 11px;
    font-size: 12px;
  }
  .opts {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--muted);
  }
  .opts label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }
  .in {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    width: 100%;
  }
</style>
