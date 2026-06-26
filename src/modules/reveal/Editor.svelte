<script lang="ts">
  import type { BroadcastPayload, DisplayMode } from '../../lib/types';
  import { assetPut, assetUrl } from '../../lib/db';
  import { DEFAULT_DISPLAY_MODE } from '../../broadcast/display';
  import { MOODS, DEFAULT_MOOD } from '../../broadcast/mood';
  import { putOnAir, clearBroadcast, setDisplayMode, setMood } from './bus-actions';

  let display = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  let moodId = $state(DEFAULT_MOOD.id);

  function pickDisplay(m: DisplayMode) {
    display = m;
    setDisplayMode(m);
  }

  function pickMood(id: string) {
    moodId = id;
    setMood(id);
  }

  let mode = $state<'text' | 'image'>('text');
  let title = $state('A Strange Symbol');
  let body = $state('Carved into the warehouse wall, still wet with brine.');
  let src = $state('');
  let caption = $state('');
  // Local object URL for an uploaded file (revoked when replaced).
  let uploadUrl = $state('');
  let dragOver = $state(false);

  function setUpload(url: string) {
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    uploadUrl = url;
    src = url;
  }

  // Revoke the last preview URL when the editor unmounts (no leak on tab close).
  $effect(() => () => {
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
  });

  async function accept(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const id = await assetPut(file, file.type);
    const url = await assetUrl(id);
    if (url) setUpload(url);
  }

  function onFile(e: Event) {
    void accept((e.currentTarget as HTMLInputElement).files?.[0]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    void accept(e.dataTransfer?.files?.[0]);
  }

  function send() {
    const payload: BroadcastPayload =
      mode === 'text' ? { kind: 'text', title, body } : { kind: 'image', src, caption };
    putOnAir(payload);
  }
</script>

<div class="editor">
  <header class="ehead">
    <h2>Reveal</h2>
    <div class="seg">
      <button class:on={mode === 'text'} onclick={() => (mode = 'text')}>Text</button>
      <button class:on={mode === 'image'} onclick={() => (mode = 'image')}>Image</button>
    </div>
  </header>

  {#if mode === 'text'}
    <input class="in" bind:value={title} placeholder="Title (optional)" />
    <textarea class="in" rows="5" bind:value={body} placeholder="Body text"></textarea>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drop"
      class:over={dragOver}
      ondragover={(e) => (e.preventDefault(), (dragOver = true))}
      ondragleave={() => (dragOver = false)}
      ondrop={onDrop}
    >
      {#if uploadUrl}
        <img class="thumb" src={uploadUrl} alt="upload preview" />
      {:else}
        <span class="muted">Drop an image here</span>
      {/if}
      <label class="btn sm">
        Choose file
        <input type="file" accept="image/*" onchange={onFile} hidden />
      </label>
    </div>
    <input class="in" bind:value={src} placeholder="…or paste an image URL" />
    <input class="in" bind:value={caption} placeholder="Caption (optional)" />
  {/if}

  <div class="actions">
    <button class="btn solid" onclick={send}>Send to Broadcast</button>
    <button class="btn" onclick={clearBroadcast}>Clear</button>
  </div>

  <div class="display">
    <span class="muted">Display:</span>
    <div class="seg">
      <button class:on={display === 'cinematic'} onclick={() => pickDisplay('cinematic')}>
        Cinematic
      </button>
      <button class:on={display === 'plain'} onclick={() => pickDisplay('plain')}>Plain</button>
    </div>
  </div>

  <div class="display">
    <span class="muted">Mood:</span>
    <div class="moods">
      {#each MOODS as m (m.id)}
        <button class="moodbtn" class:on={moodId === m.id} onclick={() => pickMood(m.id)}>
          {m.label}
        </button>
      {/each}
    </div>
  </div>
  <p class="muted hint">Screen-share the broadcast window; players see only what you send here.</p>
</div>

<style>
  .editor {
    padding: 22px 26px;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ehead {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ehead h2 {
    font-family: Georgia, serif;
    font-size: 22px;
    color: #e9f3ed;
  }
  .seg button {
    padding: 7px 14px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .seg button:first-child {
    border-radius: 8px 0 0 8px;
  }
  .seg button:last-child {
    border-radius: 0 8px 8px 0;
    border-left: 0;
  }
  .seg button.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
  }
  .in {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .display {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .hint {
    font-size: 12px;
  }
  .moods {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .moodbtn {
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .moodbtn.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 18px;
    border: 1px dashed var(--line2);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.18);
    text-align: center;
  }
  .drop.over {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.12);
  }
  .thumb {
    max-width: 100%;
    max-height: 160px;
    border-radius: 8px;
    border: 1px solid var(--line2);
  }
  .btn.sm {
    padding: 6px 13px;
    font-size: 13px;
    cursor: pointer;
  }
  .btn.sm input {
    display: none;
  }
</style>
