<script lang="ts">
  // App-wide toast host. Mounted once in App.svelte. Renders the single current
  // toast from the shared store, styled as a telegram / newspaper-clipping slip.
  import { toast } from '../lib/stores/toast.svelte';
  import { t } from '../lib/i18n';
</script>

{#if toast.current}
  <div class="toast-host" role="status" aria-live="polite">
    <div class="toast">
      <span class="msg">{toast.current.message}</span>
      {#if toast.current.undoFn}
        <button class="undo" onclick={() => toast.undo()}>{t('toast.undo')}</button>
      {/if}
      <button class="x" onclick={() => toast.dismiss()} aria-label={t('toast.dismiss')}>×</button>
    </div>
  </div>
{/if}

<style>
  .toast-host {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12000;
    pointer-events: none;
  }
  /* Telegram / newspaper-clipping slip: aged paper, torn edges, monospace. */
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-radius: 2px;
    background: #efe7d2;
    color: #211d15;
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
    box-shadow:
      0 10px 26px -8px rgba(0, 0, 0, 0.75),
      inset 0 0 0 1px rgba(120, 100, 60, 0.35);
    -webkit-mask:
      radial-gradient(5px 5px at 5px 0, transparent 96%, #000) 0 0 / 12px 100%,
      radial-gradient(5px 5px at 5px 100%, transparent 96%, #000) 0 100% / 12px 100%,
      linear-gradient(#000, #000);
    mask:
      radial-gradient(5px 5px at 5px 0, transparent 96%, #000) 0 0 / 12px 100%,
      radial-gradient(5px 5px at 5px 100%, transparent 96%, #000) 0 100% / 12px 100%,
      linear-gradient(#000, #000);
    -webkit-mask-repeat: repeat-x, repeat-x, no-repeat;
    mask-repeat: repeat-x, repeat-x, no-repeat;
    -webkit-mask-composite: source-out;
    mask-composite: subtract;
  }
  .msg {
    white-space: nowrap;
  }
  .undo {
    border: none;
    background: transparent;
    color: #7a2f12;
    font: inherit;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
  }
  .undo:hover {
    color: #a83c12;
    text-decoration: underline;
  }
  .x {
    border: none;
    background: transparent;
    color: #6a5f47;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }
  .x:hover {
    color: #211d15;
  }
</style>
