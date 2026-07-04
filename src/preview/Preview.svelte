<script lang="ts">
  import { notebook, type Note } from '../modules/notebook/store.svelte';
  import NotebookDesktop from '../modules/notebook/Desktop.svelte';
  import NotebookEditor from '../modules/notebook/Editor.svelte';

  // ---- deterministic mock data mirroring the Session Notes v2 design mock ----
  const now = Date.now();
  const min = 60_000;
  const day = 86_400_000;
  const mock: Note[] = [
    {
      id: 'prep',
      body:
        '## Next-session prep\nGoals for the next table\n- [x] Reveal @The Ferryman at the vault\n- [ ] Drop the [[Silver Locket]] clue\n- [ ] Stat the antechamber trap #encounter\nThe party still trusts @Vale — use it. Reveal is set at [[Frostmarch Vault]] the moment they open the ledger.',
      at: now - 2 * min,
      tags: ['encounter', 'prep'],
      pinned: true,
      ctx: { ivDate: '16 Frostmarch' },
    },
    {
      id: 'enc',
      body: 'Encounter — [[Vault Antechamber]]\n- Foes: @Vale\n- Terrain:\n- Twist:\n#encounter',
      at: now - 9 * min,
      tags: ['encounter'],
      ctx: { round: 3, onAir: 'The Parlor', ivDate: '16 Frostmarch' },
    },
    {
      id: 'bribe',
      body: 'Party bribed @Vale for the ledger #lead',
      at: now - 24 * min,
      tags: ['lead'],
      ctx: { round: 3, onAir: 'The Parlor', ivDate: '16 Frostmarch' },
    },
    {
      id: 'bigbad',
      body: 'Big bad reveal at [[Frostmarch Vault]] #mystery',
      at: now - 5 * day,
      tags: ['mystery'],
      ctx: { round: 7, onAir: 'The Veil', ivDate: '11 Frostmarch' },
    },
    {
      id: 'loot',
      body: 'Loot: 200gp + a silver locket #loot',
      at: now - 5 * day - 20 * min,
      tags: ['loot'],
      ctx: { round: 9, ivDate: '11 Frostmarch' },
    },
  ];

  notebook.notes = mock;
  notebook.focusedId = 'prep';

  const params = new URLSearchParams(location.search);
  const which = params.get('c') ?? 'all';
  if (params.get('q')) notebook.query = params.get('q') as string;
  if (params.get('tag')) notebook.activeTag = params.get('tag') as string;
</script>

<div class="ph-root">
  {#if which === 'widget' || which === 'all'}
    <section class="ph-block">
      <div class="ph-label">widget · Desktop.svelte (344×520)</div>
      <div class="ph-window">
        <div class="ph-winbar"><span class="ph-t">Session Notes</span></div>
        <div class="ph-wincontent"><NotebookDesktop /></div>
      </div>
    </section>
  {/if}

  {#if which === 'editor' || which === 'all'}
    <section class="ph-block ph-grow">
      <div class="ph-label">editor · Editor.svelte</div>
      <div class="ph-editor"><NotebookEditor /></div>
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
  }
  .ph-label {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  /* mimic the real desktop window chrome so the widget reads at true size */
  .ph-window {
    width: 344px;
    height: 520px;
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
    padding: 9px 10px;
  }
  .ph-editor {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg2);
  }
</style>
