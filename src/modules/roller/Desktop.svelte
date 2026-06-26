<script lang="ts">
  import { rollOutcome, rollD100 } from './logic';

  let roll = $state(37);
  const outcome = $derived(rollOutcome(roll));
  function reroll() {
    roll = rollD100();
  }
</script>

<div class="diebox">
  <div class="dt">d100</div>
  <div class="dn">{roll}</div>
  <div class="ds">{outcome}</div>
</div>
<div class="row">
  <button class="btn solid" onclick={reroll}>Roll</button>
  <button class="btn" onclick={reroll}>Roll Multiple</button>
</div>
