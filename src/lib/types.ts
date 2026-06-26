import type { ModuleId } from './module';

// A desktop window hosts one module's desktop view.
export type WindowKind = ModuleId;

export interface WindowState {
  id: string;
  kind: WindowKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
}

// What the GM pushes to the shared broadcast window.
// `ping` is a transient overlay marker (normalized 0..1 coords) drawn over
// whatever is currently on air — it does not replace the on-air content.
export type BroadcastPayload =
  | { kind: 'clear' }
  | { kind: 'image'; src: string; caption?: string }
  | { kind: 'text'; title?: string; body: string }
  | { kind: 'map'; src: string; reveal: number[][] }
  | { kind: 'ping'; x: number; y: number }
  // Audio cue routed through the broadcast tab's <audio> element. `channel`
  // separates looping ambience from one-shot SFX so they don't cut each other.
  | { kind: 'audio'; src: string; loop: boolean; action: 'play' | 'stop'; channel: 'ambient' | 'sfx' };

export type DisplayMode = 'cinematic' | 'plain';

// GM -> Broadcast control messages. `broadcast` swaps the on-air content;
// `display` changes only how that content is framed (player-facing chrome);
// `mood` washes the page with a color/lighting preset (id only — the broadcast
// page resolves the preset locally, so no GM-private data crosses the channel).
export type BusMessage =
  | { type: 'broadcast'; payload: BroadcastPayload; at: number }
  | { type: 'display'; mode: DisplayMode; at: number }
  | { type: 'mood'; moodId: string; at: number };
