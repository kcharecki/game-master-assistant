<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  // Shared empty-state: one line of flavor + an optional action button, so an
  // empty list/library reads as intentional rather than broken.
  let {
    text,
    actionLabel,
    onAction,
    icon = 'plus',
  }: {
    text: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: IconName;
  } = $props();
</script>

<div class="empty">
  <p class="emptytxt">{text}</p>
  {#if actionLabel && onAction}
    <button class="btn" onclick={onAction}><Icon name={icon} /> {actionLabel}</button>
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 26px 16px;
    margin: auto;
    text-align: center;
    color: var(--muted);
  }
  .emptytxt {
    font-size: 12.5px;
    font-style: italic;
    max-width: 30ch;
    line-height: 1.5;
  }
</style>
