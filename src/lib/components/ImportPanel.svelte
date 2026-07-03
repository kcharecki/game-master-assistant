<script lang="ts">
  import { t } from '../i18n';

  // Paste-JSON importer with a one-click "copy the LLM prompt" button. The GM
  // copies the prompt, feeds it to an LLM with a photo, pastes the JSON back.
  // `onImport` applies the parsed data and returns a status line to show.
  let {
    promptText,
    placeholder,
    onImport,
  }: {
    promptText: string;
    placeholder: string;
    onImport: (raw: string) => { ok: boolean; message: string };
  } = $props();

  let raw = $state('');
  let msg = $state('');
  let ok = $state(true);
  // Revealed (read-only, pre-selected) copy of the prompt when the clipboard is
  // blocked, so the GM can always select it by hand.
  let showPrompt = $state(false);

  async function writeClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to execCommand */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const done = document.execCommand('copy');
      ta.remove();
      return done;
    } catch {
      return false;
    }
  }

  async function copyPrompt() {
    if (await writeClipboard(promptText)) {
      ok = true;
      msg = t('jsonImport.copied');
      showPrompt = false;
    } else {
      ok = false;
      msg = t('jsonImport.copyFail');
      showPrompt = true; // reveal it for manual copy
    }
  }

  // Pre-select the revealed prompt so Ctrl+C just works.
  function selectAll(node: HTMLTextAreaElement) {
    node.focus();
    node.select();
  }

  function doImport() {
    const r = onImport(raw);
    ok = r.ok;
    msg = r.message;
    if (r.ok) raw = '';
  }
</script>

<div class="ip">
  <textarea
    class="ipta"
    bind:value={raw}
    placeholder={placeholder}
    spellcheck="false"
    rows="4"
  ></textarea>
  <div class="iprow">
    <button class="btn solid" onclick={doImport} disabled={!raw.trim()}>{t('jsonImport.import')}</button>
    <button class="btn" onclick={copyPrompt} title={t('jsonImport.copyHint')}>{t('jsonImport.copyPrompt')}</button>
    {#if msg}<span class="ipmsg" class:ok class:err={!ok}>{msg}</span>{/if}
  </div>
  {#if showPrompt}
    <textarea class="ipta" readonly rows="5" use:selectAll>{promptText}</textarea>
  {/if}
</div>

<style>
  .ip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--line2);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.22);
  }
  .ipta {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    color: var(--txt);
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    resize: vertical;
  }
  .iprow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .btn:hover:not(:disabled) {
    background: rgba(47, 138, 102, 0.16);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .ipmsg {
    font-size: 11px;
  }
  .ipmsg.ok {
    color: var(--green);
  }
  .ipmsg.err {
    color: #e6907f;
  }
</style>
