# Design Gap — current state → Unified Design System

Target = `Unified Design System brief/`. Current = shipped code. Reference, not target: the code
drifted per-component and must converge. Items below are the concrete refactors.

## 1. Token layer (`src/app.css :root`) — fix first, everything inherits it

| Token | Current | Target | Action |
|---|---|---|---|
| `--bg` | `#080d0b` | bg/0 `#070C0A` | retune |
| `--bg2` | `#0b1411` | bg/1 `#0B1310` | retune → this is the **one input well** |
| `--panel` | `#0f1815` | surface/1 `#0F1714` | retune |
| `--panel2` | `#13201b` | surface/2 `#141E19` | retune |
| — | missing | surface/3 `#19261F` (card hover) | add `--panel3` |
| — | missing | surface/menu `rgba(11,18,15,.97)` | add `--menu-bg` |
| `--line` | `rgba(95,150,120,.18)` | edge/1 `rgba(134,178,153,.14)` | **hue + alpha wrong** |
| `--line2` | `rgba(95,150,120,.32)` | edge/2 `rgba(134,178,153,.28)` | hue + alpha wrong |
| — | missing | edge/3 `rgba(134,178,153,.45)` | add `--line3` |
| `--txt` | `#dbeae1` | text/1 `#DCEAE2` | retune |
| `--muted` | `#a7bcb0` | text/2 `#A9BEB2` | ~ok |
| `--faint` | `#8a9d93` | text/3 `#879A90` | ~ok |
| — | missing | text/ink `#0A130E` | add `--ink` (text on green/gold fills) |
| `--green`/`-dim`/`-glow` | ✓ | green/1/2/3 | match — keep |
| — | missing | fill/g-08 `.08`, g-14 `.14`, g-22 `.22` at `rgba(111,208,160,*)` | add 3 fill tokens |
| `--red` | `#d97a7a` | red/1 `#E08D8D` | **bump for AA** (4.2→5.1:1) |
| `--red-dim` | `#8a4a4a` ✓ | red/2 | keep |
| — | missing | fill/red `#7A2A2A` | tokenize (hardcoded everywhere) |
| `--gold` | `#d6b65e` ✓ | gold/1 | keep |
| — | missing | gold/2 `#EEC87E`, gold-ink `#171106`, fill/gold-12, edge/gold `.45` | add |
| `--r` | single `9px` | **retire** → `--r1 4 · --r2 7 · --r3 10 · --r4 14 · --r-pill 999` | replace |
| — | missing | `--num: 'Cormorant'` tabular numeric font | add + `@font-face` already present |
| density `--ctrl/--ic/--ctrl-pad` | ✓ | + derive `--field · --row · --menu-item` from same 3 densities | extend |

Two green hues in play: fills use `rgba(79,163,123)` (16 hits, 3 files) but design fills use
`rgba(111,208,160)`. Standardize fills on `111,208,160`; keep `79,163,123`/`4fa37b` for borders only.

## 2. Global systemic drift (grep-confirmed)

- **Radii:** 197 hardcoded `border-radius` across 32 files (3–14px, 9 distinct values). Collapse to
  the 4+pill scale via `--r1..--r4`. (change-log #04)
- **Line hue:** `rgba(95,150,120,*)` — 19 hits, 8 files. Migrate to `134,178,153` via `--line*`.
- **Georgia numerals:** 10 files hardcode `Georgia` for stats/dice/clocks/dates. Swap to
  `--num` (Cormorant SemiBold, `tabular-nums`) — `.iv` 17px, `.dn` 46px in app.css included. (#09)
- **Gold misuse:** gold in 19 files; much of it is **selection/cursor** (stage tiles, cursor beats,
  inline-edit borders, segmented). Gold is on-air ONLY. Selection → focus-green solid; armed →
  green dashed; aired → gold. (#01, #02, #14)
- **Off-hue input wells:** `#11160f` / `rgba(0,0,0,.25)` / `rgba(0,0,0,.3)` in stage + notebook.
  All fields → bg/1 `#0B1310`. (#03)

## 3. Component targets (states + recipe per brief)

- **Buttons** → reduce to 6: primary (solid green), secondary (tinted `fill/g-08`), ghost, icon
  (30×30 ghost), danger-quiet (red border, red hover fill), gold on-air (TAKE/LIVE only). All share
  `--ctrl` height / `--r2` / `--ctrl-pad`. Stage `.btn`/`.ico` (dark `rgba(9,16,13,.8)`) fold in. (#07)
  Current `.btn` fill is `rgba(79,163,123,.1)` → move to `fill/g-08`.
- **Inputs/forms** → text/textarea/number/select/search/file/inline-edit/slider/checkbox/radio/switch.
  Rest/focus(green + 3px `.13` ring)/error(red + ring)/disabled. Label above (10.5/.14em/600, 5px gap)
  → field → help/error below (11px). Inline-edit border **green not gold**.
- **Menus/popovers/toasts** → one floating surface: `--menu-bg` at `--r3`, 4px pad, edge/2, e/2
  shadow, `blur(10px)`, 30px items at `--r1`. Merge topbar menu + stage menu + feedback panel. (#06)
  Selected item = green fill + check, never gold. Danger red on hover only.
- **Window chrome** → title strip fixed 32px; 20px ghost controls (close hovers red); module glyph
  goes green on focus; feedback button → proper icon + count badge. Windows `--r4`. (#13)
- **Containers** → editor/scene tabs 34px, active = 2px green top rule + green dot when dirty (no
  asterisk). Beat cards state language: green-solid=editing, green-dashed=armed, gold=on air.
  Chips (source r/2 draggable · tag pill · fork quiet→mint). List rows 32px, selected = green fill
  `.12` + inset 2px green bar. Empty state = dashed edge/2 + serif title + italic + pill actions.
- **Status** → topbar on-air lamp is **gold** when live (currently red — red is danger only). Panic
  = quiet danger inside lamp. Badges (green count / gold LIVE / red REC). Hidden = 45° hatch `.3`
  black + 40% dim + struck-eye glyph. Candle loader kept; skeletons shimmer green `.06→.14`.
- **Typography** → one label style everywhere: 10.5/.14em/600/muted, color variants only. Ban sub-9px.
  Serif (IM Fell) names things (titles/headers/in-fiction); sans operates; Cormorant counts. (#08)
- **Icons** → 24-box, stroke 1.8, round caps, `currentColor`. Replace dingbats
  `↺ ↷ ▦ ✦ ☾ ⑂ ⧉ ✕ ＋ 💬` with glyphs: undo, redo, grid, laser, moon, fork, duplicate,
  eye-off, spotlight. Sizes: 13 chrome / 16 controls / 20 features. (#10)

## 4. Suggested order

1. Rewrite `:root` tokens (section 1) — non-visual-breaking where names kept; add new tokens.
2. Global sweeps: line hue, radii→vars, Georgia→`--num`, input wells→bg/1.
3. Gold→green selection fix (highest-signal visual bug) across stage/planner.
4. Per-component convergence (section 3), one module at a time, green gate + commit each.

Full rationale = "09 What changed & why" in `Design System.dc.html` (14 items, referenced as #NN above).
