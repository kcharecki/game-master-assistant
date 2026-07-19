<script lang="ts">
  import { onMount } from 'svelte';
  import type { ModuleId } from './lib/module';
  import { lang } from './lib/stores/lang.svelte';
  import Topbar from './components/Topbar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Desktop from './surfaces/Desktop.svelte';
  import EditorHost from './surfaces/EditorHost.svelte';
  import Palette from './modules/palette/Palette.svelte';
  import { palette } from './modules/palette/store.svelte';
  import { density } from './lib/stores/density.svelte';
  import Toast from './components/Toast.svelte';
  import { resolveWikilink } from './lib/wikilink';
  import { locStrings } from './lib/loc';
  import { lore } from './modules/lore/store.svelte';
  import { npcs } from './modules/npcs/store.svelte';
  import { rules } from './modules/rules/store.svelte';
  import { initiative } from './modules/initiative/store.svelte';
  import { toast } from './lib/stores/toast.svelte';
  import { makeSnapshot } from './lib/backup';

  // Surface 1 (desktop) + surface 2 (editors) live here; the left rail switches
  // between them. Surface 3 (broadcast) is a separate page.
  let view = $state<'desktop' | ModuleId>('desktop');

  function openEditor(id: ModuleId) {
    view = id;
  }

  onMount(() => {
    void lang.load();
    void density.load();
    // Load the NPC roster at boot so it survives a refresh regardless of which
    // surface opens first (previously only the Stage window triggered the load).
    void npcs.load();
    // Rules & rulings library; stamp new rulings with the live combat round.
    void rules.load();
    rules.contextLabel = () =>
      initiative.order.length > 0 && initiative.round >= 1 ? `Round ${initiative.round}` : undefined;

    // Resolve notebook [[wikilinks]] to a lore page or NPC and jump there.
    function onWikilink(e: Event) {
      const name = (e as CustomEvent<{ name: string }>).detail?.name;
      if (!name) return;
      const hit = resolveWikilink(
        name,
        lore.pages.map((p) => ({ id: p.id, name: p.title })),
        npcs.list.flatMap((n) => locStrings(n.name).map((nm) => ({ id: n.id, name: nm }))),
      );
      if (!hit) {
        toast.show(`No lore page or NPC named “${name}”`);
        return;
      }
      openEditor(hit.module);
      if (hit.module === 'lore') lore.select(hit.id);
      else npcs.focus(hit.id);
    }
    window.addEventListener('notebook:wikilink', onWikilink);

    // Auto-backup: snapshot campaign state when the tab is about to unload.
    function onUnload() {
      void makeSnapshot();
    }
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('notebook:wikilink', onWikilink);
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  // Let the command palette open editor tabs when a result targets one.
  palette.onOpenEditor = openEditor;

  // Global Ctrl/Cmd+K toggles the command palette from anywhere.
  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      palette.toggle();
    }
  }
  function showDesktop() {
    view = 'desktop';
  }
  function openBroadcast() {
    window.open('broadcast.html', 'gm-broadcast', 'width=1280,height=720');
  }
</script>

<svelte:window onkeydown={onGlobalKeydown} />

<Palette />
<Toast />

<div class="app">
  <Topbar onOpenBroadcast={openBroadcast} />
  <div class="shell">
    <Sidebar activeView={view} onShowDesktop={showDesktop} onOpenEditor={openEditor} />
    <main class="workspace">
      <div class="surface">
        {#if view === 'desktop'}
          <Desktop />
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
  .surface {
    flex: 1;
    min-height: 0;
    display: flex;
  }
</style>
