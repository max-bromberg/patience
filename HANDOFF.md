# Patience — Agent Handoff

Snapshot for the next agent picking up work with fresh context. Written at commit
`f17363a` on `main`.

## What this is

**Patience** is a cozy, mobile-first collection of single-player card games
(solitaires + trick-taking games with AI opponents), built with SvelteKit
(Svelte 5 runes) + TypeScript (strict) + Tailwind v4 + Vitest, prerendered with
`adapter-static` and deployed to **GitHub Pages** at **patience.maxbromberg.me**.

- **Deploy:** every push to `main` triggers `.github/workflows/deploy.yml`. The
  user has authorized pushing **directly to `main`** (no PR needed). Confirm the
  deploy run goes green after pushing (GitHub MCP tools, `deploy.yml`).
- **Author/commit convention (REQUIRED):** commit as the user, with the model as
  co-author. Use:
  ```
  git -c user.name="Max Bromberg" -c user.email="maxwell.bromberg@gmail.com" commit ...
  ```
  Every commit message ends with these two trailers:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RVwV271z3xZ671b5DNCz3n
  ```
- **Never** put the raw model id (`claude-opus-4-8`) in commits, PRs, code, or any
  pushed artifact. Keep it out of everything in the repo.
- Repo scope is `max-bromberg/patience` only.

## Before you commit — gates

Always run and keep green:

```
pnpm test      # 166 tests
pnpm lint      # prettier --check + eslint (prettier --write first to autofix)
pnpm check     # svelte-check, 0 errors
pnpm build     # adapter-static, must succeed
```

ESLint is strict: no unused vars/imports, `prefer-svelte-reactivity` (no
`Set`/`Map` in `$state` — use arrays/records), `svelte/no-navigation-without-resolve`
(wrap links in `resolve()` or add an eslint-disable line for external URLs).

## Architecture (where things live)

- `src/lib/engine/` — **pure** game engine (no Svelte/DOM). `GameDefinition<S,M>` +
  `GamePresenter` → `Game`. Immutable state, seeded `mulberry32` PRNG,
  Fisher–Yates `shuffle`, move-log sessions (undo = replay), `Card` with stable ids.
- `src/lib/games/<game>/` — 13 solitaires (klondike, klondikeDraw1, freecell,
  yukon, fortythieves, scorpion, spider1/2/4, golf, tripeaks, pyramid, acesup),
  each `index.ts` + tests. `registry.ts` is the catalog manifest (add a game = add
  one line). `shared.ts` has common pile/foundation helpers.
- `src/lib/render/` — Svelte shell (may use DOM):
  - `Table.svelte` — generic solitaire board; computes card sizing from a measured
    container width. **Card sizing knobs:** `MIN_W=30`, `MAX_W=120` (desktop cap).
  - `CardView.svelte` — one card; 3D flip with a belt-and-suspenders `visibility`
    toggle so face-down cards don't leak their face on WebKit.
  - `GameController` (`controller.svelte.ts`) — reactive bridge for solitaire.
  - `GameIcon.svelte` — per-game SVG emblem generator (motif + suit accent +
    optional badge), keyed by game id in an `ICONS` map.
  - `StatsSheet.svelte` — the local-stats modal.
  - `sound.ts` — synthesized SFX (Web Audio, no assets). `music.ts` — generative
    ambient pad (see below). `Confetti.svelte`, `VibeLayer.svelte` (ambient vibes).
- `src/lib/trick/` — trick-taking games. **Two engine kinds**, both dispatched
  from the player route via `registry.ts` (`kind: 'euchre' | 'ai'`):
  - **Euchre family** (bespoke): `euchre.ts` (variant-configurable: 4p partners,
    2p duel, 3p cutthroat — `VARIANTS`), `cards.ts` (24-card bower ranking),
    `controller.svelte.ts` (`EuchreController`), `EuchreTable.svelte`.
  - **52-card AI games** (generic framework): `standard.ts` (deck/ranking/trick
    helpers), `aigame.ts` (the `AiCardGame<S>` interface + normalized `TableView`
    / `TrickMove` so ONE UI drives them all), `aicontroller.svelte.ts`
    (`AiTableController`), `TrickTable.svelte` (generic UI). Games on it:
    `hearts.ts`, `spades.ts`, `whist.ts`, `ohhell.ts`. Each is pure + seeded with
    a deterministic heuristic AI and full game-termination tests.
- `src/lib/theme/` — `theme.css` (CSS custom properties; 14 themes + custom +
  light themes; felt is grain + weave + vignette layers), `faces.css`/`faces.ts`
  (15 card-face styles), `themes.ts`, `vibes.ts`/`VibeLayer.svelte`, `color.ts`.
- `src/lib/storage/` — SSR-safe `localStorage` wrappers: `storage.ts`,
  `settings.svelte.ts` (sound, music, musicVolume, theme, face, custom colors,
  vibes), `daily.svelte.ts`, `resume.ts` (in-progress persistence),
  `stats.svelte.ts` (per-game played/won/streak/best + bestMoves/bestTimeMs).
- `src/routes/+page.svelte` — home/catalog (grouped by family, per-game icons,
  random-game + continue buttons, daily card, card quote, settings + stats modals).
- `src/routes/play/[gameId]/+page.svelte` — the player. Dispatches solitaire vs
  euchre vs ai-game. Owns: stats recording, win-streak toast, keyboard shortcuts
  (`N` new deal, `U` undo), per-deal stopwatch, auto-finish cascade.
- `src/routes/+layout.svelte` — theme/face sync to `<html>`, custom-color CSS vars,
  mobile `theme-color`, and the **music lifecycle** (gesture-gated start).
- `src/app.html` — pre-paint theme script + SEO (OG/Twitter/JSON-LD). Also
  `static/robots.txt` + a prerendered `src/routes/sitemap.xml/+server.ts`.

## Key systems / conventions to know

- **Responsive table scaling (desktop):** `Table.svelte` (solitaire) sizes cards
  from container width, capped at `MAX_W=120`. The trick tables
  (`TrickTable.svelte`, `EuchreTable.svelte`) compute
  `scale = clamp(1, feltW/460, 1.85)` from a `bind:clientWidth`, expose it as a
  `--sc` CSS var, and multiply card px sizes, overlaps, gaps, fonts, and panel
  offsets by it. **`scale === 1` on phones, so mobile is unchanged** — preserve
  this invariant for any sizing change. The Euchre up-card uses a lower cap
  (`upScale ≤ 1.3`) and top-aligns so the bidding panel clears it on desktop.
- **Trick-taking UI contract:** a new 52-card game only needs to implement
  `AiCardGame<S>` (`newGame/view/apply/stepAuto/suggest`) and be registered with
  `ai(game)` in `src/lib/trick/registry.ts`; `TrickTable` + `AiTableController`
  render and pace it. `stepAuto` returns the next state or `null` when it's the
  human's turn — the controller drives it on a timer so AI turns animate.
- **Audio (Web Audio, no assets).** `music.ts` ships 3 warm "moods" that rotate
  one per session (persisted `music-mood` counter). iOS Safari needs all of:
  an in-gesture silent-buffer unlock, a hidden looping `<audio>` element (flips
  the session to the media channel past the mute switch), and resume-on
  visibility/pointer. Music **defaults on** at medium volume; start is
  gesture-gated (toggle starts it directly; `+layout` kicks it on first
  interaction when left on). Don't break the gesture gating.
- **Stats** record on conclusion: solitaire win/stuck (with moves+time), trick
  game `gameOver` (win = `winnerLabel` starts with "You"). Guarded so each game
  records once; the win-streak toast fires on the 2nd+ consecutive win.

## Environment gotchas (this session hit all of these)

- **Screenshot review fails on large PNGs.** The image-review API rejects big
  images. Capture **JPEG at quality ~50–55** and modest dimensions (≤ ~1366 wide)
  via CDP; those (~15–30 KB) review fine. Headless Chromium lives at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Drive it over the
  DevTools Protocol with `--remote-debugging-port`; for CDP `Runtime.evaluate`
  the value is at `result.result.value`.
- **`--virtual-time-budget` is flaky** for trick games mid-animation (cards render
  blank). Prefer a real `setTimeout` wait (~3.5s) before `Page.captureScreenshot`.
- **`pkill -f vite` returns exit 1 when nothing matches**, which **short-circuits
  `&&` chains** (e.g. `pkill ... && pnpm build` silently skips the build, and a
  backgrounded preview never starts). Run `pkill` on its own line or append
  `; true`. Start the preview with the run-in-background tool, then poll
  `curl -s -o /dev/null -w '%{http_code}'` until `200` before screenshotting.
- Headless layout viewport sometimes renders wider than the requested
  `--window-size` (e.g. ~500px CSS for a 420px window), which can clip right-edge
  content in a screenshot even though it's fine on a real device. Verify true
  mobile with `Emulation.setDeviceMetricsOverride` (390px) when in doubt.

## Status: done this session

Solitaire engine + 13 games; Euchre family (4p/2p/3p); 4 new 52-card AI games
(Hearts, Spades, Whist, Oh Hell) on a shared framework; theme/face/vibe systems;
daily challenge; resume; home catalog with per-game icons, random-game,
continue, and a card-quote header; **local stats** + Stats sheet; **win-streak
toast**; **keyboard shortcuts** (N/U); best-time/moves records; **refined felt
texture**; **SEO** (OG/Twitter/JSON-LD/sitemap/robots); **card-back leak fix**;
**desktop sizing pass** (trick tables scale up, solitaire cap lowered, mobile
unchanged); **iOS Safari music fix**; **daily-challenge card recolors with the
theme**; **UI icon set** (see below); **bright, tuneful music overhaul** (see below).

- **UI button redesign (DONE).** All chrome buttons now use a reusable
  `src/lib/render/Icon.svelte` — inline SVG drawn with `currentColor`, so each
  icon inherits the button's themed `color` (`--ui-text`, `--drop-ring`, …) and
  recolors automatically with any theme / custom palette. Glyphs are card-themed
  where it reads well (`deal` = two shuffling cards, `dice` for random,
  `continue` = play). Wired into the play top bar (`back/undo/deal/sound-on/
  sound-off/help/auto`) and the home top-right (`stats/settings`) + quick actions
  (`dice/continue`). Tap targets kept ≥ 2.3rem and the existing `aria-label`s
  preserved. Verified at 390px and 1366px.
- **Music overhaul (DONE).** `src/lib/render/music.ts` was rewritten from the old
  low/minor "moods" (which read as brooding/eerie) to three bright **major-key**
  moods (Sunbeam C, Lagoon F, Dusk→**Carousel** D), each an **8-chord** voicing
  in a higher register with a shorter glide so chords stay defined, a higher
  filter cutoff for air, and a **sparse bell "twinkle" melody** that plucks notes
  from the current chord so it feels playful and tuneful, not a drone. Chords are
  written by note name via a small `hz()` helper. Default-on / gesture-gated /
  iOS plumbing all unchanged.

## Pending / next up

1. **Audition the new music on a real device / with audio** (headless can't play
   sound). Confirm it reads as warm/bright/fun, the bell twinkle sits gently
   under the pad, and the per-session mood rotation works (Sunbeam → Lagoon →
   Carousel). Tune `twinkleGain` / `chordMs` / `cutoff` per mood if needed.
2. **Verify the daily-challenge recolor** across a few themes (blossom/ocean/
   custom) and light themes — confirm contrast/legibility. (color-mix is used;
   supported in current Safari/Chrome.)
3. **Optional polish ideas raised earlier (not requested yet):** "personal best!"
   flourish in the win toast when a win beats the stored fastest time / fewest
   moves; more AI games on the 52-card framework (Pitch, Knockout Whist); a
   solitaire-style Euchre adaptation.

## How to wrap up any task here

Make the change → `prettier --write` the touched files → `pnpm check && pnpm lint
&& pnpm test && pnpm build` → commit with the author/trailer convention above →
`git push origin main` → confirm the `deploy.yml` run is green. Verify UI changes
with small JPEG screenshots at both a mobile (390px) and desktop (~1366px)
viewport, and keep `scale === 1` behavior identical on mobile.
