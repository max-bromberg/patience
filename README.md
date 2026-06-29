# Patience 🂡

A cozy, mobile-first collection of single-player card games — solitaires plus
trick-taking games against AI opponents. Static, fast, cute, and animated. No
accounts, no backend: everything runs client-side and deploys as static files.

**▶ Play live: https://patience.maxbromberg.me**

## Games

**20 games** across two broad kinds, each registered as a small module
(`src/lib/games/registry.ts` for solitaires, `src/lib/trick/registry.ts` for
trick games).

- **Solitaire (13)**
  - _Builder:_ Klondike (draw-3 / draw-1), FreeCell, Yukon, Forty Thieves, Scorpion
  - _Spider:_ Spider (1 / 2 / 4 suit)
  - _Adder:_ Golf, TriPeaks
  - _Pairer:_ Pyramid
  - _Discarder:_ Aces Up
- **Trick-taking (7)**
  - _Euchre family:_ Euchre (4-player partners), Euchre Duel (2-player), Cutthroat
    Euchre (3-player) — a bespoke 24-card bower engine.
  - _52-card AI games:_ Hearts, Spades, Whist, Oh Hell — a shared framework where
    each game is a pure, seeded module with a deterministic heuristic AI, all
    driven by one table UI.

## Features

- **Daily challenge** — a date-seeded deal everyone shares, with a local streak.
- **Shareable deals** — any game accepts `?seed=<n>` for a reproducible deal.
- **Share your result** — finish a game and copy a Wordle-style emoji blurb (with
  a replayable link) to paste into a text.
- **Resume** — in-progress casual games persist and restore on reload.
- **Local stats** — per-game played / won / streak plus best time & fewest moves,
  with a stats sheet and a win-streak celebration.
- **Auto-finish & stuck detection** — a cascade to clear a solved board, and a
  universal "no moves left" prompt.
- **Theming** — 14 preset felt themes (dark _and_ light) plus a custom colour
  builder (felt / card-back / accent), 15 card-face styles, and toggleable ambient
  "vibes" (hearth, casino, aurora, vignette, sparkle).
- **Themed UI icons** — the chrome buttons are inline SVGs drawn with
  `currentColor`, so they recolour with the active theme automatically.
- **Sound & music** — synthesized sound effects and a generative, music-box style
  background score (warm major-key arpeggios), both fully synthesized via Web
  Audio — no audio assets.
- **Keyboard shortcuts** — <kbd>N</kbd> new deal, <kbd>U</kbd> undo.
- **SEO** — Open Graph / Twitter cards, JSON-LD, a prerendered sitemap and robots.

## Tech stack

- **SvelteKit** (Svelte 5 runes) + **Vite** — compiles to a tiny runtime; native
  `animate:flip` and `svelte/transition` for card motion.
- **TypeScript (strict)** — the game engine is `any`-free and DOM-free.
- **Tailwind v4** + targeted custom CSS for the felt-table aesthetic.
- **Vitest** — the pure game logic is unit-tested; this is the correctness backbone.
- **`@sveltejs/adapter-static`** → prerendered static files on **GitHub Pages**
  (custom domain, served from root).

## Architecture

A hard separation between **pure logic** and **rendering**:

- `src/lib/engine/` — pure TypeScript (no Svelte/DOM). Seeded `mulberry32` RNG,
  Fisher–Yates shuffle, immutable state + a move log (→ undo via replay,
  reproducible deals), `Card` with stable ids.
- `src/lib/games/` — each solitaire is a `GameDefinition<S, M>` module + tests,
  registered in `registry.ts`; shared rules live in `shared.ts`.
- `src/lib/trick/` — the Euchre engine and the generic 52-card `AiCardGame`
  framework, each with its own controller + table component.
- `src/lib/render/` — a generic, game-agnostic shell (Table / Pile / CardView, a
  pointer-events drag layer for touch + mouse parity, icons, sound/music).
- `src/lib/theme/`, `src/lib/storage/` — themes/faces/vibes and SSR-safe
  `localStorage`-backed settings, stats, daily, and resume state.

Adding a solitaire = write one logic module + register it. No shell changes.

## Develop

```sh
pnpm install
pnpm dev          # dev server
pnpm test         # run Vitest once
pnpm check        # svelte-check / typecheck
pnpm lint         # prettier --check + eslint
pnpm format       # prettier --write
pnpm build        # static production build → ./build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. The custom domain lives in `static/CNAME`; `.nojekyll`
keeps Pages from stripping `_app/` assets.

The original build plan and shelved ideas live in [`PROPOSAL.md`](PROPOSAL.md) and
[`docs/themes-backlog.md`](docs/themes-backlog.md).
