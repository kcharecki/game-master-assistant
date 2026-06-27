<script lang="ts">
  import { improvPrompt, type ImprovPrompt } from './logic';
  import { t } from '../../lib/i18n';

  let current = $state<ImprovPrompt | null>(null);

  function roll() {
    current = improvPrompt();
  }
</script>

<div class="im">
  <button class="btn" onclick={roll}>{t('improv.prompt')}</button>
  {#if current}
    <div class="card">
      <span class="kind">{t('improv.kind.' + current.kind)}</span>
      <p class="text">{current.text}</p>
    </div>
  {:else}
    <p class="muted">{t('improv.hint')}</p>
  {/if}
</div>

<style>
  .im {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  }
  .btn {
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.18);
  }
  .kind {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--green);
  }
  .text {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--txt);
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
</style>
