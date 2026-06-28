# Patience 🂡

A cozy, mobile-first collection of single-player card games (solitaire family and
beyond). Static, fast, cute, animated. No accounts, no backend — everything runs
client-side and deploys as static files.

**Live:** https://patience.maxbromberg.me

## Tech stack

- **SvelteKit** + **Vite** — compiles away to a tiny runtime; native `animate:flip`
  and `svelte/transition` for card motion.
- **TypeScript (strict)** — engine code is `any`-free and DOM-free.
- **Tailwind v4** + targeted custom CSS for the felt-table aesthetic.
- **Vitest** — pure game logic is unit-tested; this is the correctness backbone.
- **`@sveltejs/adapter-static`** → prerendered static files on **GitHub Pages**
  (custom domain, served from root — no `paths.base` prefixing).

## Architecture

Hard separation between **pure logic** and **rendering**:

- `src/lib/engine/` — pure TypeScript (no Svelte/DOM imports). Seeded RNG, deck,
  piles, immutable `applyMove` + move log (→ undo, reproducible deals).
- `src/lib/games/` — each game is a `GameDefinition<S, M>` module + Vitest tests,
  registered in `registry.ts`.
- `src/lib/render/` — a generic, game-agnostic shell (Table / Pile / CardView +
  a Pointer-Events drag layer for touch + mouse parity).

Adding a game = write one logic module + register it. No shell changes.

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

## Build phases

See `PROPOSAL.md` for the full plan. Phases: **0** scaffold + live deploy ·
**1** engine core · **2** render/interaction shell · **3** Klondike ·
**4** catalog/home · **5** second game + polish — all complete.

## Games & features

- **11 games** across three families, each a pure module registered in
  `src/lib/games/registry.ts` (shared rules live in `src/lib/games/shared.ts`):
  - _Builder:_ Klondike (draw-3 / draw-1), FreeCell, Yukon, Forty Thieves, Scorpion
  - _Spider:_ Spider (1 / 2 / 4 suit)
  - _Adder:_ Golf, TriPeaks
- **Daily challenge:** a date-seeded deal everyone shares, with a local streak
  (`src/lib/daily.ts`, `src/lib/storage/daily.svelte.ts`).
- **Shareable deals:** any game accepts `?seed=<n>` for a reproducible deal.
- **Resume:** in-progress casual games persist and restore on reload
  (`src/lib/storage/resume.ts`).
- **Auto-finish & stuck detection:** a cascade to clear a solved board, and a
  universal "no moves left" prompt.
- **Theming:** preset felt themes + a custom color builder (felt / card-back /
  accent), and toggleable ambient "vibes" (hearth, casino, aurora, vignette,
  sparkle) — `src/lib/theme/*`, `src/lib/render/VibeLayer.svelte`.
- **Sound:** synthesized via Web Audio (`src/lib/render/sound.ts`), mute toggle.
- **How to play:** per-game `howTo` steps + a learn-more link in the player.

All settings persist in `localStorage`. Shelved theming ideas live in
[`docs/themes-backlog.md`](docs/themes-backlog.md).
