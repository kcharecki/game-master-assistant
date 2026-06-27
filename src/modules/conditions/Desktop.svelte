<script lang="ts">
  import { conditions, type Effect } from './store.svelte';
  import { t } from '../../lib/i18n';

  let target = $state('');
  let name = $state('');
  let rounds = $state(2);
  let expired = $state<Effect[]>([]);

  function addEffect() {
    if (!name.trim()) return;
    conditions.add(target.trim() || '—', name.trim(), rounds);
    name = '';
  }

  function tick() {
    expired = conditions.tick();
  }
</script>

<div class="initbar">
  <span class="rnd">{conditions.list.length} {t('conditions.active')}</span>
  <button class="btn solid sm" onclick={tick}>{t('conditions.tick')}</button>
</div>

{#if expired.length}
  <div class="expired" data-no-drag>
    {t('conditions.expired')} {expired.map((e) => `${e.name} (${e.target})`).join(', ')}
  </div>
{/if}

{#each conditions.list as e (e.id)}
  <div class="combatant">
    <span class="cn"><div class="nm">{e.name}</div><div class="rl">{e.target}</div></span>
    <span class="iv" class:low={e.rounds <= 1}>{e.rounds}</span>
    <span class="ord" data-no-drag>
      <button class="ob x" onclick={() => conditions.remove(e.id)} aria-label={t('conditions.remove')}>✕</button>
    </span>
  </div>
{/each}

<form class="add-row" data-no-drag onsubmit={(ev) => (ev.preventDefault(), addEffect())}>
  <input class="in" placeholder={t('conditions.effectPlaceholder')} bind:value={name} aria-label={t('conditions.effectName')} />
  <input class="in t" placeholder={t('conditions.targetPlaceholder')} bind:value={target} aria-label={t('conditions.target')} />
  <input class="in n" type="number" min="1" bind:value={rounds} aria-label={t('conditions.rounds')} />
  <button class="btn sm" type="submit" aria-label={t('conditions.addEffect')}>＋</button>
</form>

<style>
  .initbar {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .btn.sm {
    padding: 5px 11px;
    font-size: 12px;
  }
  .initbar .btn.sm {
    margin-left: auto;
  }
  .iv.low {
    color: var(--red);
  }
  .expired {
    font-size: 12px;
    color: var(--gold);
    margin-bottom: 10px;
    padding: 6px 9px;
    border-radius: 8px;
    background: rgba(199, 164, 78, 0.1);
    border: 1px solid rgba(199, 164, 78, 0.3);
  }
  .add-row {
    display: flex;
    gap: 5px;
    margin-top: 8px;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .in.t {
    flex: 0 0 70px;
  }
  .in.n {
    flex: 0 0 48px;
  }
  .ord {
    display: flex;
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
</style>
