<script lang="ts">
  import { system } from '../../lib/stores/system.svelte';
  import { check, type CheckResult } from './logic';

  // For D&D `value` = modifier, `target` = DC. For CoC `value` = skill rating.
  let value = $state(50);
  let target = $state(15);
  let result = $state<CheckResult | null>(null);

  const isDnd = $derived(system.current === 'dnd5e');

  // Reset the displayed result when the system flips (the inputs mean different things).
  let lastSystem = system.current;
  $effect(() => {
    if (system.current !== lastSystem) {
      lastSystem = system.current;
      result = null;
      value = isDnd ? 3 : 50;
    }
  });

  function roll() {
    result = check(system.current, value, target);
  }
</script>

<div class="cbbar">
  <span class="rnd">{system.config.label} check</span>
  <button class="btn solid sm" onclick={roll}>Roll</button>
</div>

<div class="fields" data-no-drag>
  {#if isDnd}
    <label>Mod<input type="number" bind:value aria-label="Modifier" /></label>
    <label>DC<input type="number" bind:value={target} aria-label="Difficulty class" /></label>
  {:else}
    <label>Skill<input type="number" min="1" max="99" bind:value aria-label="Skill rating" /></label>
  {/if}
</div>

<div class="diebox">
  {#if !result}
    <div class="ds">enter a check</div>
  {:else if result.system === 'dnd5e'}
    <div class="dn" class:good={result.success} class:bad={!result.success}>{result.total}</div>
    <div class="ds">
      d20 {result.roll}{result.modifier >= 0 ? ' +' : ' '}{result.modifier} vs DC {result.dc}
      · {result.success ? 'SUCCESS' : 'fail'} ({result.margin >= 0 ? '+' : ''}{result.margin})
      {#if result.crit}<span class="hid">· nat 20</span>{/if}
      {#if result.fumble}<span class="err">· nat 1</span>{/if}
    </div>
  {:else}
    <div class="dn" class:good={result.success} class:bad={!result.success}>{result.roll}</div>
    <div class="ds">vs skill {result.skill} · {result.outcome}</div>
  {/if}
</div>

<style>
  .cbbar {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .cbbar .btn.sm {
    margin-left: auto;
    padding: 5px 13px;
    font-size: 13px;
  }
  .fields {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  .fields label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
  }
  .fields input {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 14px;
  }
  .diebox {
    text-align: center;
    padding: 10px;
    border-radius: 9px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.2);
  }
  .dn {
    font-size: 30px;
    font-weight: 800;
  }
  .dn.good {
    color: var(--green, #5fbf8f);
  }
  .dn.bad {
    color: var(--red);
  }
  .ds {
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
  }
  .hid {
    color: var(--gold);
  }
  .err {
    color: var(--red);
  }
</style>
