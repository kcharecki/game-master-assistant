<script lang="ts">
  import { planner } from '../modules/planner/store.svelte';
  import PlannerDesktop from '../modules/planner/Desktop.svelte';
  import PlannerEditor from '../modules/planner/Editor.svelte';

  // Deterministic mock — mirrors the Session Planner redesign mock. The store
  // already seeds the Hollowmere one-shot; just pin the run cursor + stop the
  // IndexedDB load from clobbering it.
  planner.currentId = 'b-parley';
  planner.selectedId = 'b-parley';
  planner.load = async () => {};

  const params = new URLSearchParams(location.search);
  const which = params.get('c') ?? 'all';
</script>

<div class="ph-root">
  {#if which === 'widget' || which === 'all'}
    <section class="ph-block">
      <div class="ph-label">widget · Desktop.svelte (run cockpit · 320×320)</div>
      <div class="ph-window">
        <div class="ph-winbar"><span class="ph-t">Session Planner</span></div>
        <div class="ph-wincontent"><PlannerDesktop /></div>
      </div>
    </section>
  {/if}

  {#if which === 'editor' || which === 'all'}
    <section class="ph-block ph-grow">
      <div class="ph-label">editor · Editor.svelte</div>
      <div class="ph-editor"><PlannerEditor /></div>
    </section>
  {/if}
</div>

<style>
  :global(body) {
    background: var(--bg);
    margin: 0;
  }
  .ph-root {
    display: flex;
    gap: 28px;
    align-items: flex-start;
    padding: 28px;
    min-height: 100vh;
  }
  .ph-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ph-grow {
    flex: 1;
    min-width: 0;
    max-width: 640px;
  }
  .ph-label {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .ph-window {
    width: 340px;
    height: 560px;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--green-dim);
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    box-shadow: 0 0 0 1px rgba(79, 163, 123, 0.35);
  }
  .ph-winbar {
    flex: 0 0 auto;
    padding: 5px 9px;
    background: linear-gradient(180deg, rgba(34, 62, 50, 0.55), rgba(15, 24, 21, 0.25));
    border-bottom: 1px solid var(--line);
  }
  .ph-t {
    font-family: var(--serif);
    font-size: 13px;
    color: var(--green);
  }
  .ph-wincontent {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
  }
  .ph-editor {
    height: 720px;
    display: flex;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    overflow: hidden;
  }
  .ph-editor :global(.pe) {
    flex: 1;
  }
</style>
