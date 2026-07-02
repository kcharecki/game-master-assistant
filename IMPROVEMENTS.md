# Improvements Plan

Backlog of proposed improvements. Source: feature/UX review (2026-07-02). Not scheduled — pick rows into ROADMAP milestones as needed.

## 1. Audio module (deep dive)

### Bugs (fix first)
- [ ] Hotkey/badge mismatch — `Desktop.svelte` draws `kbd 1-9` on *filtered* `shownSfx`; `playSfxByHotkey` indexes unfiltered `this.sfx`. Filter on → key fires wrong clip on air.
- [ ] Seek thumb fights incoming `audioStatus` while dragging — freeze position updates between pointerdown/up.
- [ ] Hotkey guard misses `contenteditable` (only INPUT/TEXTAREA/SELECT).
- [ ] Deleting all playlists resurrects seed lists on reload (`saved.playlists?.length` guard in `load()`).

### Cheap wins (store supports, UI missing)
- [ ] Inline rename (dblclick) for tracks + SFX (`renameTrack`/`renameSfx` exist).
- [ ] Per-SFX gain + group assignment UI (`setSfxGain`/`setSfxGroup` exist).
- [ ] Duck toggle in UI (`duckSfx` state exists, invisible).
- [ ] Click track row → play from that index (`queueCue` takes index; `playScene` hardcodes 0).

### Layout / IA
- [ ] Add `Editor.svelte`: imports, YouTube URLs, rename, gains, groups, reorder. Desktop widget becomes live console only (now-playing, transport, scene switch, pads, master vol).
- [ ] Now-playing header: big track label, elapsed/remaining, "next up".
- [ ] Soundboard chips → larger pads, color per group, flash/progress while playing.
- [ ] Collapse mixer to master + popover; add per-channel mute + panic button (fade all out 0.5s).
- [ ] Drag-to-reorder tracks (`lib/actions/drag`) instead of ▲▼.
- [ ] Drag-drop import onto soundboard (now track list only).

### Live-play confidence
- [ ] Broadcast-tab-closed warning: no `audioStatus` within ~1s of play → banner + "open broadcast" button.
- [ ] Local audition: hold/right-click chip or track = GM-tab-only preview, never bus.
- [ ] Fade-out on stop/pause (~1s ramp) instead of hard cut.
- [ ] Scene→scene crossfade (mid-play `playScene` is a hard cut today).
- [ ] Undo toast on scene/track/SFX delete (instant + irreversible today).

### Polish
- [ ] Track duration in list (read metadata on import).
- [ ] YouTube titles via oEmbed (no API key) instead of `YouTube <id>`.
- [ ] Shuffle per playlist.
- [ ] Perceptual volume curve (`v*v`) for usable low range.
- [ ] Space = pause/resume when widget focused.
- [ ] Palette verbs: "play tavern", "stop audio", SFX by name.
- [ ] Recording: rename prompt on stop + level meter.
- [ ] Per-playlist gain trim.
- [ ] Asset cleanup: `removeTrack`/`removeSfx` orphan blobs in IndexedDB.

## 2. Improvements to existing modules

### Map
- [ ] Multi-cell tokens (2×2, 3×3 for large/huge).
- [ ] Measure tool: ruler + AoE templates (cone/sphere/line), optional on broadcast.
- [ ] Fog reveal fades in on broadcast (no pop).
- [ ] Freehand/polygon fog (corridors don't fit rect marquee).
- [ ] Map library: save maps with fog+tokens, quick switch.
- [ ] Token movement tween on broadcast.
- [ ] GM-only drawing layer (annotations, traps, walls).
- [ ] Hex grid + gridless modes.
- [ ] Token status rings: player-visible condition icons, per-condition toggle.
- [ ] Death saves + "down" token state.

### Stage / Reveal / Handouts
- [ ] Tile fade/slide transitions; scene-to-scene crossfade on broadcast.
- [ ] New tile kinds: countdown clock, in-world date/moon, dice result, map snapshot.
- [ ] Tile layering/z-order (text over image).
- [ ] Progressive image reveal: blur→sharp or slow crop-pan.
- [ ] On-air history: last N payloads, one-click re-air.
- [ ] Parchment/letter/telegram text themes for handouts.

### Initiative / Roller
- [ ] Player-safe initiative strip on broadcast (names + current turn only).
- [ ] Condition durations auto-decrement on next-turn with expiry toast.
- [ ] Public roll to broadcast: big animated result card.
- [ ] Roll history log with labels.

### Cross-cutting
- [ ] Palette verbs, not just nouns ("air scene 2", "start break", "mood: dread").
- [ ] Notebook `[[name]]` auto-links to lore/NPCs; notes stamped with in-world date.
- [ ] Window snap-to-edges + per-module remembered size.
- [ ] Custom mood editor + timed mood transitions.
- [ ] Auto-backup snapshot at session end (`lib/backup`).

## 3. New features

1. Progress clocks — BitD-style segmented clocks, broadcastable.
2. Doom countdown overlay — timer/tension meter over any on-air content.
3. Party frame bar — broadcast portrait strip with GM-controlled visible status, no numbers.
4. Stat block manager + encounter builder (re-add) — monster library, CR budget.
5. Weather engine — generator + broadcast particle overlays (rain, snow, fog).
6. Cutscene sequencer — scripted chain: stage scene → audio cue → text card.
7. Intermission screen — "back in 10:00" splash with art + music.
8. Title cards — lower-third/chapter overlays.
9. Shop generator — merchant inventory + broadcast storefront.
10. Overland/hex travel map — party marker, revealed regions, calendar-linked day counter.
11. Puzzle module — GM-driven interactive puzzles on broadcast (cipher wheel, rune tiles).
12. Chase/vehicle tracker — abstract track positions, obstacles per round.
13. Light & vision on battle map — torch radii, darkness beyond light player-side.
14. Recap cinematic — auto "previously on…" slideshow from aired images + notes + music.
15. Quest journal (broadcastable) — player-safe open-quests page.
16. Faction web (re-add) — relationship graph, GM-only.
17. Ambient video loops — mp4/webm loop assets as stage backgrounds.
18. Prep tray — pin tonight's NPCs/maps/handouts/tracks into one launch strip.
19. SRD importer — monster/spell JSON into statblocks + rules.
20. Safety tools — panic button: instant black screen + calm audio + "pause" card; GM-side lines/veils list.

## 4. Site design (usability + Cthulhu vibe)

Theme today: séance-green dark (`--bg #080d0b`, `--green #6fd0a0`), system-ui body, Georgia accents.

### Usability
- [ ] Replace mixed emoji glyphs (✎ 🗑 ⏮ ＋) with one line-icon set — emoji render inconsistently across OS, sizes jump.
- [ ] Consistent focus rings + visible keyboard path everywhere (some `.ic` buttons have none).
- [ ] Bump muted-text contrast to AA on dark panels (`--muted` on `--bg2` is borderline).
- [ ] Bigger hit targets for live-play controls (20px `.ic` buttons too small mid-session); density toggle compact/comfortable.
- [ ] Tooltips with hotkey hints on every icon-only control.
- [ ] Prominent global ON AIR lamp in topbar: what's broadcasting now + one-click clear/black-screen (panic).
- [ ] Empty states: one line of flavor + action button ("The archive is empty. *Add your first handout.*").
- [ ] Undo-toast pattern app-wide for destructive actions (delete window content, scenes, pages).
- [ ] Snap guides + edge magnetism when dragging windows; remember last size per module.
- [ ] Styled scrollbars + selection color to match theme (default blue selection breaks vibe).

### Cthulhu atmosphere (cheap, CSS-first)
- [ ] Display serif for window titles/section headers (IM Fell English or Cormorant via self-hosted font) — occult print feel; body stays sans for legibility.
- [ ] Subtle paper-grain/noise texture overlay on desktop + vignette (already partial radial gradient; extend).
- [ ] Faint drifting fog layer at very low opacity behind windows; respect `prefers-reduced-motion`.
- [ ] Focused window: verdigris border glow + slightly raised shadow; unfocused windows dim 5–10%.
- [ ] Per-module sigil icons in title bars (small SVG set: eye, tentacle, candle, key…).
- [ ] Toasts styled as telegram/newspaper-clipping strips.
- [ ] Loading/busy states: flickering candle or blinking Keeper eye (asset exists — eye already animated).
- [ ] Broadcast cinematic mode: film grain + letterbox + slow vignette pulse; mood presets get matching grain tint.
- [ ] Hover on interactive elements: ink-bleed/glow transition (~120ms) instead of instant color swap.
- [ ] Optional GM-local UI sounds (page rustle, soft click) — off by default, master-volume gated.

## 5. Note-taking for the GM (notebook module)

Today: single-line input, `#tag` parsing, text search, tag filter, recap, delete. No edit, no multiline, no links, no sessions.

### Capture faster
- [ ] 1. Multiline input — textarea, Shift+Enter = newline, Enter = save (single-line `<input>` today).
- [ ] 2. Quick-capture from anywhere — global hotkey and/or palette verb `note: goblin took the idol`; no window focus needed.
- [ ] 3. Auto-context stamp — note records what was happening: initiative round, on-air content, in-world calendar date.
- [ ] 4. Tag autocomplete on `#` + `@npc` autocomplete from roster.
- [ ] 5. Voice notes — quick mic capture attached to a note (reuse audio recording infra).
- [ ] 6. Attach image/asset to a note (paste or pick from assets).
- [ ] 7. Note templates — session-prep skeleton, encounter note, loot note; one-click insert.

### Organize & revisit
- [ ] 8. Edit existing notes (delete-only today).
- [ ] 9. Session grouping — notes auto-bucketed per session, collapsible headers ("Session 12 — Jul 2").
- [ ] 10. Pin notes — sticky at top of list.
- [ ] 11. TODO checkboxes — `- [ ]` renders as toggle; open TODOs surface as next-session prep list.
- [ ] 12. Markdown rendering — bold/italic/lists in note bodies.
- [ ] 13. `[[wikilink]]` to lore pages and NPCs — click jumps to module; lore shows backlinks from notes.
- [ ] 14. Tag management — rename/merge tags; tag rename rewrites bodies.
- [ ] 15. Undo delete (toast) + archive instead of hard delete.
- [ ] 16. Cross-session full-text search with match highlight ("what was that innkeeper's name?").

### Output & prep
- [ ] 17. Recap 2.0 — select which notes feed it, edit result, **air to broadcast** as "previously on…" text card.
- [ ] 18. Prep vs play modes — prep checklist written before session; items check off and convert to timestamped play notes when they happen.
- [ ] 19. Export session as markdown file download.
- [ ] 20. Notebook `Editor.svelte` — full-page journal tab (two-pane: sessions list + editor); desktop widget stays quick capture.

## Suggested order
1. Audio bugs + cheap wins (§1)
2. ON AIR lamp + panic button (§4)
3. Map player-facing polish: fog fade, token tween, status rings (§2)
4. Audio editor split + broadcast-closed warning (§1)
5. Icon set + focus/contrast pass (§4)
6. Prep tray + progress clocks (§3)
