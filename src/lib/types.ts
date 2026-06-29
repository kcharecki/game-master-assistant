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
  collapsed: boolean;
}

// What the GM pushes to the shared broadcast window.
// `ping` is a transient overlay marker (normalized 0..1 coords) drawn over
// whatever is currently on air — it does not replace the on-air content.
// NOTE: blob: object URLs are document-scoped and DO NOT resolve in another tab.
// For uploaded assets send `assetId`; the broadcast tab loads the blob from the
// shared IndexedDB and makes its own URL. `src` is only for external (http) URLs.
// Optional explicit placement of a grid cell in the broadcast grid (1-based,
// CSS-grid semantics). When present on any cell the renderer switches from
// auto-flow to absolute placement: `col`/`row` are start lines, `cw`/`rh` spans.
// Cells without an area fall back to auto-flow (legacy Composer behaviour).
export interface GridArea {
  col: number;
  row: number;
  cw: number;
  rh: number;
}

// One cell of a `grid` broadcast. Image cells follow the same asset-id rule as
// the top-level image payload: send `assetId` for uploaded blobs; `src` is only
// for external (http) URLs. Cells are GM-composed and player-safe by design.
export type GridCell =
  | { kind: 'image'; assetId?: string; src?: string; caption?: string; area?: GridArea }
  | { kind: 'text'; title?: string; body?: string; area?: GridArea };

export type BroadcastPayload =
  | { kind: 'clear' }
  | { kind: 'image'; src?: string; assetId?: string; caption?: string }
  | { kind: 'text'; title?: string; body: string }
  // Battle map. `tokens` carry only player-safe fields (position/label/colour) —
  // HP, conditions and hidden state never cross to the broadcast.
  | {
      kind: 'map';
      src?: string;
      assetId?: string;
      reveal: number[][];
      tokens?: { gx: number; gy: number; label: string; color: string; conditions?: string[] }[];
      /** background placement in the shared world space (px): top-left (x,y) +
       *  display size (w,h). Grid/fog/tokens use cell coords in that same space,
       *  so the broadcast aligns exactly with the GM canvas. */
      img?: { x: number; y: number; w: number; h: number };
      /** the world-px fragment to show on air (the broadcast viewBox); fills the
       *  player window keeping ratio. */
      view?: { x: number; y: number; w: number; h: number };
    }
  // `rows` is only needed when cells carry explicit `area` placement (Stage);
  // auto-flow grids (Composer) omit it.
  | { kind: 'grid'; cols: number; rows?: number; cells: GridCell[] }
  | { kind: 'ping'; x: number; y: number }
  // Audio cue routed through the broadcast tab's <audio> element. `channel`
  // separates looping ambience from one-shot SFX so they don't cut each other.
  // `seek` (action 'seek') moves the ambient playhead to `seek` seconds (rewind
  // = seek 0). `youtubeId` plays the cue as an embedded YouTube iframe instead.
  | {
      kind: 'audio';
      src?: string;
      assetId?: string;
      youtubeId?: string;
      /** YouTube only: play sound but hide the video (offscreen iframe). */
      audioOnly?: boolean;
      loop: boolean;
      action: 'play' | 'stop' | 'seek';
      channel: 'ambient' | 'sfx';
      seek?: number;
    };

export type DisplayMode = 'cinematic' | 'plain';

// GM -> Broadcast control messages. `broadcast` swaps the on-air content;
// `display` changes only how that content is framed (player-facing chrome);
// `mood` washes the page with a color/lighting preset (id only — the broadcast
// page resolves the preset locally, so no GM-private data crosses the channel).
export type BusMessage =
  | { type: 'broadcast'; payload: BroadcastPayload; at: number }
  | { type: 'display'; mode: DisplayMode; at: number }
  | { type: 'mood'; moodId: string; at: number }
  // Reverse channel: the broadcast tab reports ambient/sfx playback position back
  // to the GM tab so it can drive the transport (seek slider + time readout).
  | {
      type: 'audioStatus';
      channel: 'ambient' | 'sfx';
      current: number;
      duration: number;
      playing: boolean;
      at: number;
    };
