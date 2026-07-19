<script lang="ts">
  import { rules } from '../modules/rules/store.svelte';
  import { system } from '../lib/stores/system.svelte';
  import { lang } from '../lib/stores/lang.svelte';
  import RulesDesktop from '../modules/rules/Desktop.svelte';
  import RulesEditor from '../modules/rules/Editor.svelte';

  // Deterministic mock: don't let the IndexedDB load clobber the seed, show a
  // couple of rulings (incl. one linked to a builtin) so related-rulings + the
  // rulings tab have content, and pin one entry to demo the pin overlay.
  rules.load = async () => {};
  system.current = 'dnd5e';
  rules.rulings = [
    {
      id: 'demo-1',
      title: 'Called shots do +2, never crit',
      body: 'Aiming at a limb adds 2 damage but can never critical.',
      system: 'dnd5e',
      ruleId: 'crit',
      tags: ['house'],
      createdAt: '2026-07-12T20:00:00.000Z',
      sessionLabel: 'Session 4',
      status: 'active',
    },
    {
      id: 'demo-2',
      title: 'Inspiration can be gifted to another PC',
      body: 'A player may hand their Inspiration to a teammate before a roll.',
      system: 'dnd5e',
      ruleId: 'inspiration',
      tags: ['house'],
      createdAt: '2026-07-05T19:30:00.000Z',
      sessionLabel: 'Round 3',
      status: 'active',
    },
  ];
  rules.pinned = ['death-saves'];

  const params = new URLSearchParams(location.search);
  const which = params.get('c') ?? 'all';
  if (params.get('lang') === 'pl') lang.current = 'pl';
</script>

<div class="ph-root">
  {#if which === 'widget' || which === 'all'}
    <section class="ph-block">
      <div class="ph-label">widget · Desktop.svelte (360×380)</div>
      <div class="ph-window">
        <div class="ph-winbar"><span class="ph-t">Rules &amp; Rulings</span></div>
        <div class="ph-wincontent"><RulesDesktop /></div>
      </div>
    </section>
  {/if}

  {#if which === 'editor' || which === 'all'}
    <section class="ph-block ph-grow">
      <div class="ph-label">editor · Editor.svelte</div>
      <div class="ph-editor"><RulesEditor /></div>
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
    max-width: 1040px;
  }
  .ph-label {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .ph-window {
    width: 360px;
    height: 460px;
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
    font-size: 12px;
    color: var(--txt);
  }
  .ph-wincontent {
    flex: 1;
    min-height: 0;
    padding: 9px;
    overflow: hidden;
  }
  .ph-editor {
    height: 620px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--green-dim);
    background: linear-gradient(180deg, var(--panel2), var(--panel));
  }
</style>
