<script lang="ts">
  import { statblock, searchStatBlocks } from './store.svelte';
  import { t } from '../../lib/i18n';

  let query = $state('');
  const shown = $derived(searchStatBlocks(statblock.library, query));
  const r = $derived(statblock.readout);

  const tierClass: Record<string, string> = {
    Trivial: 'd-triv',
    Easy: 'd-easy',
    Medium: 'd-med',
    Hard: 'd-hard',
    Deadly: 'd-deadly',
  };
</script>

<input class="search" bind:value={query} placeholder={t('statblock.searchPlaceholder')} />

<div class="lib" data-no-drag>
  {#each shown as s (s.id)}
    <div class="row">
      <span class="cn"><div class="nm">{s.name}</div><div class="rl">CR {s.cr} · {s.hp} HP · AC {s.ac}</div></span>
      <button class="btn sm" aria-label={t('statblock.addToEncounter')} onclick={() => statblock.addToEncounter(s.id)}>＋</button>
    </div>
  {/each}
</div>

<div class="encbar">
  <span class="rnd">{t('statblock.encounter')} ({statblock.fight.length})</span>
  <button class="ob" onclick={() => statblock.clearEncounter()} aria-label={t('statblock.clear')}>{t('statblock.clear')}</button>
</div>

<div class="party" data-no-drag>
  <label>{t('statblock.pcs')}<input
      type="number"
      min="1"
      value={statblock.partySize}
      oninput={(e) => statblock.setParty(+e.currentTarget.value, statblock.partyLevel)}
      aria-label={t('statblock.partySize')}
    /></label>
  <label>{t('statblock.lvl')}<input
      type="number"
      min="1"
      max="20"
      value={statblock.partyLevel}
      oninput={(e) => statblock.setParty(statblock.partySize, +e.currentTarget.value)}
      aria-label={t('statblock.partyLevel')}
    /></label>
</div>

<div class="enc" data-no-drag>
  {#each statblock.fight as s, i (i)}
    <button class="chip" onclick={() => statblock.removeFromEncounter(i)} title={t('statblock.remove')}
      >{s.name} ✕</button
    >
  {/each}
</div>

<div class="readout {tierClass[r.difficulty]}">
  <div class="diff">{r.difficulty}</div>
  <div class="xp">{r.adjustedXp} {t('statblock.adjXp')} · ×{r.multiplier} · {t('statblock.raw')} {r.rawXp}</div>
</div>

<style>
  .search {
    width: 100%;
    margin-bottom: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .lib {
    max-height: 120px;
    overflow-y: auto;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
  }
  .row .cn {
    flex: 1;
    min-width: 0;
  }
  .nm {
    font-size: 13px;
  }
  .rl {
    font-size: 11px;
    color: var(--muted);
  }
  .btn.sm {
    padding: 3px 9px;
    font-size: 12px;
  }
  .encbar {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .ob {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font-size: 11px;
  }
  .ob:hover {
    color: var(--txt);
  }
  .party {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .party label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--muted);
  }
  .party input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .enc {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
    min-height: 4px;
  }
  .chip {
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    border: 1px solid var(--line2);
    background: rgba(199, 91, 91, 0.12);
    color: var(--txt);
    cursor: pointer;
  }
  .readout {
    text-align: center;
    padding: 8px;
    border-radius: 9px;
    border: 1px solid var(--line2);
  }
  .diff {
    font-size: 18px;
    font-weight: 800;
  }
  .xp {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .d-triv {
    border-color: var(--line2);
  }
  .d-easy .diff {
    color: #5fbf8f;
  }
  .d-med .diff {
    color: var(--gold);
  }
  .d-hard .diff {
    color: #e08a4e;
  }
  .d-deadly {
    border-color: #7a2a2a;
    background: rgba(122, 42, 42, 0.18);
  }
  .d-deadly .diff {
    color: var(--red);
  }
</style>
