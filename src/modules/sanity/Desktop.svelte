<script lang="ts">
  import { sanity } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  let spec = $state('1/1d6');

  function rollFor(id: string) {
    sanity.rollLoss(id, spec);
  }
</script>

<div class="initbar">
  <span class="rnd">{t('sanity.title')}</span>
  <input class="in spec" bind:value={spec} aria-label={t('sanity.lossSpec')} placeholder="1/1d6" />
</div>

{#if sanity.last}
  {@const r = sanity.last.result}
  <div class="result" class:bout={r.bout} data-no-drag>
    d100 {r.roll} · {r.success ? t('sanity.pass') : t('sanity.fail')} · −{r.loss} {t('sanity.san')}
    {#if r.bout}<span class="bouttag">{t('sanity.bout')}</span>{/if}
  </div>
{/if}

{#if sanity.list.length === 0}
  <Empty text={t('sanity.empty')} actionLabel={t('sanity.addInvestigator')} onAction={() => sanity.add()} />
{/if}

{#each sanity.list as inv (inv.id)}
  <div class="combatant" class:foe={inv.san <= inv.maxSan / 5}>
    <span class="cn"><div class="nm">{inv.name}</div><div class="rl">{t('sanity.san')} {inv.san}/{inv.maxSan}</div></span>
    <span class="ord" data-no-drag>
      <button class="btn sm" onclick={() => rollFor(inv.id)}>{t('sanity.roll')}</button>
      <button class="ob x" onclick={() => sanity.remove(inv.id)} aria-label={t('sanity.remove')} title={t('sanity.remove')}><Icon name="close" size={12} /></button>
    </span>
  </div>
{/each}

<form class="add-row" data-no-drag onsubmit={(ev) => (ev.preventDefault(), sanity.add())}>
  <button class="btn sm" type="submit"><Icon name="plus" /> {t('sanity.addInvestigator')}</button>
</form>

<style>
  .initbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .in.spec {
    margin-left: auto;
    flex: 0 0 80px;
    padding: 5px 7px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .result {
    font-size: 12px;
    color: var(--gold);
    margin-bottom: 10px;
    padding: 6px 9px;
    border-radius: 8px;
    background: rgba(199, 164, 78, 0.1);
    border: 1px solid rgba(199, 164, 78, 0.3);
  }
  .result.bout {
    color: var(--red);
    background: rgba(122, 42, 42, 0.18);
    border-color: #7a2a2a;
  }
  .bouttag {
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .ord {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn.sm {
    padding: 5px 11px;
    font-size: 12px;
  }
  .ob {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    line-height: 1;
    font-size: 10px;
  }
  .ob.x:hover {
    color: #fff;
    background: #7a2a2a;
  }
  .add-row {
    margin-top: 8px;
  }
</style>
