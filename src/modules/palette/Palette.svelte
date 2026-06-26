<script lang="ts">
  import { palette } from './store.svelte';
  import type { PaletteHit } from './search';

  let inputEl: HTMLInputElement | undefined = $state();

  // Focus the field whenever the overlay opens.
  $effect(() => {
    if (palette.open) inputEl?.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      palette.hide();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      palette.moveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      palette.moveSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      palette.run();
    }
  }

  function badge(hit: PaletteHit): string {
    return hit.kind === 'spawn' ? 'spawn' : hit.kind === 'editor' ? 'edit' : 'open';
  }
</script>

{#if palette.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={() => palette.hide()}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="palette"
      role="dialog"
      aria-label="Command palette"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <input
        bind:this={inputEl}
        class="pin"
        type="text"
        placeholder="Search NPCs, lore, notes, quests, rules — or spawn a window…"
        value={palette.query}
        oninput={(e) => palette.setQuery((e.currentTarget as HTMLInputElement).value)}
        onkeydown={onKeydown}
      />
      <div class="results" role="listbox">
        {#each palette.results as hit, i (hit.id)}
          <button
            class="row"
            class:on={i === palette.selected}
            role="option"
            aria-selected={i === palette.selected}
            onmousemove={() => (palette.selected = i)}
            onclick={() => palette.run(hit)}
          >
            <span class="label">{hit.label}</span>
            {#if hit.detail}<span class="detail">{hit.detail}</span>{/if}
            <span class="badge">{badge(hit)}</span>
          </button>
        {:else}
          <div class="empty">No matches</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    background: rgba(2, 6, 4, 0.55);
    backdrop-filter: blur(3px);
  }
  .palette {
    width: min(560px, 92vw);
    max-height: 64vh;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.98);
    box-shadow: 0 28px 70px -20px rgba(0, 0, 0, 0.92);
    overflow: hidden;
  }
  .pin {
    padding: 16px 18px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--txt);
    font: inherit;
    font-size: 15px;
    outline: none;
  }
  .results {
    overflow-y: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 16px;
    border: 0;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  .row.on {
    background: rgba(47, 138, 102, 0.18);
  }
  .label {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    flex: 1 1 auto;
    color: var(--faint);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid var(--line2);
    border-radius: 6px;
    padding: 2px 6px;
  }
  .empty {
    padding: 18px 16px;
    color: var(--faint);
    font-size: 13px;
  }
</style>
