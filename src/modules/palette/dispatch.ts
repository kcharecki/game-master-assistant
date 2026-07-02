/**
 * Palette verb DISPATCH: turn a parsed VerbIntent into a side effect on the
 * right module store / bus action. Thin glue — all parsing + target matching
 * lives in verbs.ts (pure, tested). Returns a short result message for a toast,
 * or null when the intent couldn't be carried out (e.g. no matching target).
 */
import type { VerbIntent } from './verbs';
import { matchTarget } from './verbs';
import { stage } from '../stage/store.svelte';
import { audio } from '../audio/store.svelte';
import { timer } from '../timer/store.svelte';
import { notebook } from '../notebook/store.svelte';
import { setMood } from '../reveal/bus-actions';
import { MOODS } from '../../broadcast/mood';

export function dispatchVerb(intent: VerbIntent): string | null {
  switch (intent.kind) {
    case 'airScene': {
      const scene = stage.airSceneByRef({ index: intent.index, name: intent.target });
      return scene ? `Aired “${scene.name}”` : null;
    }
    case 'startBreak': {
      timer.start();
      return 'Timer running';
    }
    case 'mood': {
      const mood = matchTarget(
        MOODS.map((m) => ({ id: m.id, name: m.label })),
        intent.target
      );
      // also allow matching the raw id directly
      const id = mood?.id ?? MOODS.find((m) => m.id === intent.target.toLowerCase())?.id;
      if (!id) return null;
      setMood(id);
      return `Mood: ${MOODS.find((m) => m.id === id)?.label ?? id}`;
    }
    case 'playAudio': {
      const pl = matchTarget(
        audio.playlists.map((p) => ({ id: p.id, name: p.scene })),
        intent.target
      );
      if (!pl) return null;
      audio.playScene(pl.id);
      return `Playing ${pl.name}`;
    }
    case 'stopAudio': {
      audio.stopScene();
      return 'Audio stopped';
    }
    case 'sfx': {
      const s = matchTarget(
        audio.sfx.map((x) => ({ id: x.id, name: x.label })),
        intent.target
      );
      if (!s) return null;
      audio.playSfx(s.id);
      return `SFX: ${s.name}`;
    }
    case 'note': {
      const note = notebook.quickCapture(intent.text);
      return note ? 'Note captured' : null;
    }
  }
}
