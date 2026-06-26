<script lang="ts">
  import type { ModuleId } from './lib/module';
  import { getModule } from './lib/registry';
  import Topbar from './components/Topbar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Desktop from './surfaces/Desktop.svelte';
  import EditorHost from './surfaces/EditorHost.svelte';

  // Surface 1 (desktop) + surface 2 (editor tabs) live here. Surface 3 (broadcast) is a separate page.
  let view = $state<'desktop' | ModuleId>('desktop');
  let openEditors = $state<ModuleId[]>([]);

  function openEditor(id: ModuleId) {
    if (!openEditors.includes(id)) openEditors.push(id);
    view = id;
  }
  function closeEditor(id: ModuleId) {
    openEditors = openEditors.filter((x) => x !== id);
    if (view === id) view = 'desktop';
  }
  function showDesktop() {
    view = 'desktop';
  }
  function openBroadcast() {
    window.open('broadcast.html', 'gm-broadcast', 'width=1280,height=720');
  }
</script>

<div class="app">
  <Topbar onOpenBroadcast={openBroadcast} />
  <div class="shell">
    <Sidebar activeView={view} onShowDesktop={showDesktop} onOpenEditor={openEditor} />
    <main class="workspace">
      <div class="tabs">
        <button class="tab" class:on={view === 'desktop'} onclick={showDesktop}>Desktop</button>
        {#each openEditors as id (id)}
          <span class="tab" class:on={view === id}>
            <button class="tlabel" onclick={() => (view = id)}>{getModule(id).title}</button>
            <button class="tx" onclick={() => closeEditor(id)} aria-label="Close tab">✕</button>
          </span>
        {/each}
      </div>
      <div class="surface">
        {#if view === 'desktop'}
          <Desktop onOpenEditor={openEditor} />
        {:else}
          <EditorHost moduleId={view} />
        {/if}
      </div>
    </main>
  </div>
</div>

<style>
  .workspace {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 4px;
    padding: 7px 10px;
    background: #0a110e;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    display: inline-flex;
    align-items: center;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
  }
  button.tab {
    padding: 7px 12px;
  }
  .tab.on {
    background: rgba(47, 138, 102, 0.16);
    color: var(--txt);
  }
  .tlabel {
    padding: 7px 6px 7px 12px;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
  }
  .tx {
    padding: 4px 9px 4px 4px;
    background: transparent;
    border: 0;
    color: var(--faint);
    cursor: pointer;
  }
  .tx:hover {
    color: var(--txt);
  }
  .surface {
    flex: 1;
    min-height: 0;
    display: flex;
  }
</style>
