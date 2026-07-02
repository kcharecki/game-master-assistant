# Self-hosted display fonts

The Cthulhu-atmosphere serif headers use **IM Fell English** (and **Cormorant**
as a secondary) declared via `@font-face` in `src/app.css`, served from here:

- `IMFellEnglish-Regular.woff2`
- `IMFellEnglish-Italic.woff2`
- `Cormorant-SemiBold.woff2`

These binaries are **not committed** (they could not be fetched in the offline
build environment). Until they are dropped in, the `@font-face` rules fail
silently and the app falls back to the bundled serif stack
(`'Georgia', 'Times New Roman', serif`) — so headers still render, just without
the period letterforms. There is **no network/CDN dependency**.

To enable the real fonts, download the OFL-licensed woff2 files (Google Fonts /
IM Fell English by Igino Marini, Cormorant by Christian Thalmann) and place them
here with the exact filenames above.
