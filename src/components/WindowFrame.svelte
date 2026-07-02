<script lang="ts">
  import { onMount } from 'svelte';
  import type { WindowState } from '../lib/types';
  import { wm } from '../lib/stores/windows.svelte';
  import { feedback } from '../lib/stores/feedback.svelte';
  import { feedbackToMarkdown } from '../lib/feedback';
  import { getModule } from '../lib/registry';
  import { t } from '../lib/i18n';
  import { dragHandle } from '../lib/actions/drag';
  import { resizeHandle } from '../lib/actions/resize';
  import { collectGuides, snapRect } from '../lib/actions/snap';
  import Stub from './Stub.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import ModuleIcon from './ModuleIcon.svelte';

  let { win }: { win: WindowState } = $props();
  const mod = $derived(getModule(win.kind));
  const title = $derived(t('mod.' + win.kind + '.title'));
  // The top-most window (highest z among non-minimized) reads as focused: it
  // gets the verdigris glow while the rest dim slightly.
  const focused = $derived(
    win.z === Math.max(...wm.windows.filter((w) => !w.minimized).map((w) => w.z)),
  );

  onMount(() => void feedback.load());

  const SNAP_THRESHOLD = 9;

  // Snap a dragged position to screen/other-window edges with a little magnetism.
  function moveSnapped(x: number, y: number): void {
    const desk = document.getElementById('desktop');
    const others = wm.windows
      .filter((w) => w.id !== win.id && !w.minimized)
      .map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
    const vw = desk?.clientWidth ?? window.innerWidth;
    const vh = desk?.clientHeight ?? window.innerHeight;
    const guides = collectGuides(vw, vh, others);
    const snapped = snapRect({ x, y, w: win.w, h: win.h }, guides, SNAP_THRESHOLD);
    wm.move(win.id, snapped.x, snapped.y);
  }

  // Per-component feedback popover.
  let fbOpen = $state(false);
  let fbText = $state('');
  const fbItems = $derived(feedback.forModule(win.kind));

  function saveFeedback() {
    feedback.add(win.kind, win.title, fbText);
    fbText = '';
  }

  // Download all feedback (every component) as markdown for the programmer.
  function exportFeedback() {
    const md = feedbackToMarkdown(feedback.items);
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gm-feedback.md';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if !win.minimized}
  <section
    class="win"
    class:focused
    data-win
    role="group"
    aria-label={title}
    tabindex="-1"
    style="left:{win.x}px;top:{win.y}px;width:{win.w}px;height:{win.collapsed
      ? 'auto'
      : win.h + 'px'};z-index:{win.z}"
    onpointerdown={() => wm.focus(win.id)}
  >
    <div class="bar" use:dragHandle={(x, y) => moveSnapped(x, y)}>
      <span class="sigil" aria-hidden="true"><ModuleIcon id={win.kind} size={14} /></span>
      <span class="t">{title}</span>
      <span class="ctrl">
        <button
          class="b"
          class:has={fbItems.length > 0}
          data-no-drag
          onclick={() => (fbOpen = !fbOpen)}
          aria-label="Leave feedback for programmer"
          title="Leave feedback for programmer"
        >
          💬{#if fbItems.length}<sup class="fbcount">{fbItems.length}</sup>{/if}
        </button>
        <button
          class="b"
          data-no-drag
          onclick={() => wm.toggleCollapse(win.id)}
          aria-label={win.collapsed ? t('win.expand') : t('win.collapse')}
        >
          {win.collapsed ? '▸' : '▾'}
        </button>
        <button class="b x" data-no-drag onclick={() => wm.close(win.id)} aria-label={t('win.close')} title={t('win.close')}><Icon name="close" size={13} /></button
        >
      </span>
    </div>

    {#if fbOpen}
      <div class="fbpanel" data-no-drag>
        <div class="fbhead">
          <span>{t('win.feedbackFor')}{title}</span>
          <button class="fbexport" onclick={exportFeedback} title="Download all feedback (.md)"
            >{t('win.export')}</button
          >
        </div>
        {#if fbItems.length}
          <ul class="fblist">
            {#each fbItems as f (f.id)}
              <li>
                <span class="fbtext">{f.text}</span>
                <button
                  class="fbdel"
                  onclick={() => feedback.remove(f.id)}
                  aria-label={t('win.delete')}
                  title={t('win.delete')}><Icon name="close" size={12} /></button
                >
              </li>
            {/each}
          </ul>
        {/if}
        <textarea
          class="fbinput"
          bind:value={fbText}
          rows="2"
          placeholder={t('win.feedbackPlaceholder')}
        ></textarea>
        <div class="fbactions">
          <button class="fbsave" onclick={saveFeedback} disabled={!fbText.trim()}>{t('win.save')}</button>
        </div>
      </div>
    {/if}
    {#if !win.collapsed}
      <div class="content">
        {#if mod.desktop}
          {@const Desktop = mod.desktop}
          <Desktop />
        {:else}
          <Stub moduleId={win.kind} title={mod.title} />
        {/if}
      </div>
      <span
        class="grip"
        data-no-drag
        aria-label="Resize"
        use:resizeHandle={(w, h) => wm.resize(win.id, w, h)}
      ></span>
    {/if}
  </section>
{/if}

<style>
  .sigil {
    display: inline-flex;
    align-items: center;
    color: var(--muted);
    flex: 0 0 auto;
  }
  .win.focused .sigil,
  .win:focus-within .sigil {
    color: var(--green);
  }
  .fbcount {
    font-size: 8px;
    color: var(--green, #5fbf8f);
    font-weight: 700;
  }
  .fbpanel {
    position: absolute;
    top: 30px;
    right: 6px;
    z-index: 9999;
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.98);
    box-shadow: 0 16px 44px -16px rgba(0, 0, 0, 0.9);
  }
  .fbhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--faint, #6f6a5c);
  }
  .fbexport {
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
    font-size: 10px;
    padding: 2px 6px;
  }
  .fbexport:hover {
    color: var(--txt);
    background: rgba(47, 138, 102, 0.16);
  }
  .fblist {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .fblist li {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 12px;
    color: var(--txt);
    background: rgba(47, 138, 102, 0.08);
    border-radius: 6px;
    padding: 4px 6px;
  }
  .fbtext {
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }
  .fbdel {
    flex: none;
    border: 0;
    background: transparent;
    color: var(--faint, #6f6a5c);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
  }
  .fbdel:hover {
    color: #ff6b6b;
  }
  .fbinput {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .fbactions {
    display: flex;
    justify-content: flex-end;
  }
  .fbsave {
    border: 1px solid var(--line2);
    border-radius: 8px;
    background: var(--green-dim, #2f8a66);
    color: #06120c;
    font-weight: 700;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 12px;
  }
  .fbsave:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .grip {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(
      135deg,
      transparent 0 50%,
      var(--line2) 50% 60%,
      transparent 60% 72%,
      var(--line2) 72% 82%,
      transparent 82%
    );
  }
</style>
