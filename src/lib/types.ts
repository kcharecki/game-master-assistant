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

// One entry of the ambient queue handed to the broadcast sequencer. A native
// clip carries `assetId` (blob resolved tab-locally); a YouTube item carries
// `youtubeId`. `gain` is the per-track 0..1 trim applied on top of the channel
// volume so loud/quiet imports can be levelled.
export interface AudioQueueItem {
  assetId?: string;
  /** external (http) audio URL — only for non-uploaded sources */
  src?: string;
  youtubeId?: string;
  audioOnly?: boolean;
  gain?: number;
  label?: string;
}

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
  // Laser pointer: a steady dot at normalized (x,y) that overlays the current
  // on-air content and tracks the GM's cursor. `on:false` hides it. Like `ping`
  // it is transient/live-only and never clobbers `broadcastState`.
  | { kind: 'laser'; x: number; y: number; on: boolean }
  // Audio cue routed through the broadcast tab. `channel` separates the looping
  // ambient sequencer from one-shot SFX so they don't cut each other.
  //
  // Ambient is queue-driven: `action:'play'` sends the whole `queue` and a start
  // `index`; the broadcast tab runs the sequencer (crossfade, auto-advance, loop)
  // because the playback timers live in that tab. Transport actions (pause/resume/
  // next/prev/seek/volume/stop) steer the running sequence. SFX `play` is a single
  // one-shot (`assetId`/`src`), played on a pooled element so shots can overlap.
  | {
      kind: 'audio';
      channel: 'ambient' | 'sfx';
      action: 'play' | 'stop' | 'seek' | 'pause' | 'resume' | 'next' | 'prev' | 'volume' | 'panic';
      /** ambient play: ordered items to run through (native audio + YouTube). */
      queue?: AudioQueueItem[];
      /** ambient play/jump: index into `queue` to start at. */
      index?: number;
      /** sfx one-shot source (or a single ambient source). */
      src?: string;
      assetId?: string;
      youtubeId?: string;
      /** YouTube only: play sound but hide the video (offscreen iframe). */
      audioOnly?: boolean;
      /** repeat the current track instead of advancing. */
      loopTrack?: boolean;
      /** wrap to the start of the queue after the last track. */
      loopList?: boolean;
      /** crossfade duration (ms) between ambient tracks. 0 = hard cut. */
      crossfadeMs?: number;
      /** action 'seek': move the ambient playhead to this many seconds. */
      seek?: number;
      /** effective channel volume 0..1 (master × channel, precomputed by the GM). */
      volume?: number;
      /** sfx: duck the ambient bed while this shot plays. */
      duck?: boolean;
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
      /** index of the on-air ambient track within the queue (if sequencing). */
      index?: number;
      /** total tracks in the running ambient queue. */
      count?: number;
      at: number;
    };
