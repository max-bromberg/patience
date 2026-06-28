# Patience — Project Proposal & Coding-Agent Handoff

> A single-player card-game site. Static, mobile-first, fast, cute, animated.
> Repo: `https://github.com/max-bromberg/patience`

This document is the source of truth for a Claude Code build run. Decisions marked
**DECIDED** are settled — do not re-litigate them; build against them. Items under
**Open Questions** should be surfaced to the human rather than guessed.

---

## 1. Goal

A website offering a large, growing catalog of single-player card games (solitaire
family and beyond). The user picks a game from a catalog and plays it in the browser.
No accounts, no backend, no network at runtime — everything runs client-side and
deploys as static files.

**Audience & tone:** built as a gift; the aesthetic should read as _cute, warm, and
slick_ — not a utilitarian card-game dump. Think tasteful felt-table warmth, soft
shadows, satisfying motion.

## 2. Priorities (ranked — resolve trade-offs in this order)

1. **Mobile is a first-class platform, equal to desktop.** Every interaction must work
   and feel native on touch. This is not "responsive as an afterthought" — touch and
   pointer share one code path, and layouts are designed for a phone first.
2. **Fast, responsive, cute design with slick animations.** Small bundle, instant
   interaction, smooth 60fps card motion (deals, flips, pile-to-pile moves, auto-complete
   cascades).

Everything else (catalog size, feature breadth) is subordinate to these two.

## 3. Tech Stack — **DECIDED**

| Concern         | Choice                                | Why                                                                                                                                        |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework       | **SvelteKit**                         | Compiles away; smallest runtime → best mobile perf. Built-in `animate:flip` + `svelte/transition` cover the core card animations natively. |
| Build/dev       | **Vite** (bundled with SvelteKit)     | Fast HMR, standard.                                                                                                                        |
| Adapter         | **`@sveltejs/adapter-static`**        | Prerender to static files for GitHub Pages.                                                                                                |
| Language        | **TypeScript, strict mode**           | Non-negotiable for a large, testable game collection.                                                                                      |
| Styling         | **Tailwind v4** + targeted custom CSS | Fast responsive layout; custom CSS for the felt-table / card aesthetic.                                                                    |
| Logic tests     | **Vitest**                            | Pure game logic is unit-tested; this is the correctness backbone.                                                                          |
| Package manager | **pnpm**                              | Fast, disk-efficient, plays well with the GH Actions cache.                                                                                |
| Lint/format     | **ESLint + Prettier**                 | Standard SvelteKit setup.                                                                                                                  |
| Hosting         | **GitHub Pages** on a subdomain       | Deploy is trivial; see §4.                                                                                                                 |

Scaffold command:

```bash
npx sv create patience
# minimal template, TypeScript, Prettier, ESLint, Tailwind, adapter-static
```

> Rejected alternatives (do not reopen): content-first SSGs (Hugo/Jekyll/Astro-content)
> — wrong tool, this is an interactive app, not content. React + Motion — viable but
> heavier bundle; loses on priority #1.

## 4. Deployment — **DECIDED**

Serving from a **custom subdomain** (e.g. `patience.<domain>`), **not**
`max-bromberg.github.io/patience`. This is deliberate and removes the single most
error-prone part of GH-Pages SvelteKit deploys:

- **No `paths.base` repo-subpath prefixing.** A custom domain serves from root, so
  links don't need a base prefix. Leave `kit.paths.base` empty. Do **not** sprinkle
  `{base}` prefixes everywhere — they're only needed for the `/repo-name` subpath case.
- Add `static/CNAME` containing the chosen subdomain.
- Add an empty `static/.nojekyll` so GH Pages doesn't run Jekyll over the output
  (which would drop `_app/`-prefixed assets).
- `src/routes/+layout.ts` exports `export const prerender = true;`.
- Deploy via GitHub Actions (`actions/upload-pages-artifact` + `actions/deploy-pages`),
  triggered on push to `main`. Use the current SvelteKit-docs workflow as the base.

**Build Phase 0 deploy first** (see §10) so the pipeline is proven before any real code
exists. A green deploy from day one means deployment is never a looming unknown.

## 5. Architecture Principles

**Hard separation between pure logic and rendering.** This is the most important
structural rule and the thing that makes "very large selection of games" cheap.

- **Game logic is pure TypeScript with zero DOM/Svelte imports.** Each game is a module
  implementing a common interface (§7): given a state, produce legal moves; given a
  move, produce the next state; decide win/loss. Fully unit-testable headlessly.
- **Rendering is a generic shell** that knows how to draw _any_ game's state and route
  _any_ legal move back into the engine. The shell never contains game-specific rules.
- Adding a game becomes "write one logic module + register it." No shell changes.

This mirrors a control-plane / policy split: the engine is mechanism, each game is policy.

**Immutability + move log.** `applyMove` returns a new state rather than mutating. A
game session is then `initialState(seed)` plus an ordered move log, which gives **undo**
(pop the log, replay), **reproducible deals** (seed), and trivial state snapshots for free.

**Stable card identity.** Every card carries a stable `id` that persists across states.
This is what `animate:flip` keys on to animate a card smoothly from one pile to another.
Without stable ids, the slick animations don't work — treat this as load-bearing.

## 6. Repository Structure (target)

```
patience/
├─ .github/workflows/deploy.yml      # GH Pages CI
├─ static/
│  ├─ CNAME                          # subdomain
│  ├─ .nojekyll
│  └─ cards/                         # SVG card faces / deck assets
├─ src/
│  ├─ lib/
│  │  ├─ engine/                     # PURE — no Svelte/DOM imports
│  │  │  ├─ types.ts                 # Card, GameDefinition<S,M>, GameMeta, etc.
│  │  │  ├─ card.ts                  # Card construction, ranks/suits, ordering
│  │  │  ├─ deck.ts                  # build, shuffle (seeded)
│  │  │  ├─ pile.ts                  # pile helpers (move, peek, run validation)
│  │  │  ├─ rng.ts                   # seedable PRNG (e.g. mulberry32)
│  │  │  └─ session.ts               # state + move log, undo, win/loss tracking
│  │  ├─ games/
│  │  │  ├─ registry.ts              # manifest the catalog reads
│  │  │  └─ klondike/
│  │  │     ├─ index.ts              # GameDefinition implementation
│  │  │     └─ klondike.test.ts      # Vitest logic tests
│  │  ├─ render/                     # generic, game-agnostic UI
│  │  │  ├─ Table.svelte             # play surface, layout regions
│  │  │  ├─ CardView.svelte          # one card (SVG face), flip animation
│  │  │  ├─ Pile.svelte              # renders a pile, fans/stacks cards
│  │  │  └─ dnd.ts                    # pointer-event drag layer (touch + mouse)
│  │  └─ theme/                      # tokens, felt/table styles
│  └─ routes/
│     ├─ +layout.ts                  # prerender = true
│     ├─ +page.svelte                # catalog / home
│     └─ play/[gameId]/+page.svelte  # generic player, loads game by id
├─ svelte.config.js
├─ tailwind.config.* / app.css
└─ vitest.config.ts
```

## 7. Core Contracts (engine interfaces)

These are illustrative and should be refined in Phase 1, but the shape is **DECIDED**:
the engine is generic over a game-specific state `S` and move `M`.

```ts
type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // A=1 … K=13

interface Card {
	readonly id: string; // stable identity for FLIP animation keying
	readonly suit: Suit;
	readonly rank: Rank;
	faceUp: boolean;
}

interface GameMeta {
	id: string; // 'klondike'
	name: string; // 'Klondike'
	blurb: string; // one-line description for the catalog
	difficulty: 'easy' | 'medium' | 'hard';
	family: string; // grouping for the catalog, e.g. 'builder'
}

interface GameDefinition<S, M> {
	readonly meta: GameMeta;
	initialState(seed: number): S; // deterministic given seed
	legalMoves(state: S): M[]; // all currently legal moves
	applyMove(state: S, move: M): S; // PURE — returns a new state
	isWon(state: S): boolean;
	isLost?(state: S): boolean; // optional; many solitaires can dead-end
	autoMove?(state: S, card: Card): M | null; // optional: double-tap-to-foundation
	hint?(state: S): M | null; // optional
}
```

The render shell consumes `legalMoves` to highlight valid drop targets and calls
`applyMove` on a committed drag. `session.ts` wraps a `GameDefinition` with the move log,
undo, new-deal (new seed), and win/loss detection.

## 8. Shared Primitives

- **`rng.ts`** — a small seedable PRNG (mulberry32 or similar). All shuffling goes
  through it. Never `Math.random`. Seed is surfaced in the UI later (shareable deals,
  optional daily challenge).
- **`deck.ts`** — standard 52-card build; seeded Fisher–Yates shuffle.
- **`pile.ts`** — pile operations and run/sequence validation helpers games compose.
- **`dnd.ts`** — drag layer built on **Pointer Events** so touch and mouse are one path.
  Must handle: pick up a card or a valid run, follow the pointer, highlight legal targets,
  snap-with-animation on drop, spring-back on illegal drop. This module is where priority
  #1 (mobile parity) is won or lost — give it real attention and test on a phone.
- **Card art** — SVG faces (crisp at any DPI, themeable, scale for mobile). Use an
  open-licensed SVG deck set; confirm license before committing assets (see Open
  Questions). Open-source solitaire collections are good _rule references_ — read for
  correct mechanics, implement fresh, don't copy.

## 9. Persistence

Runtime is fully client-side. Use **`localStorage`** for: in-progress game state (resume
on reload), per-game win/streak stats, and theme/settings. No server, no sync. Keep it
behind a thin wrapper so it's easy to swap later. (This is a real deployed site, so
browser storage is fine here — no artifact-sandbox restrictions apply.)

## 10. Phased Build Plan

Each phase ends in something runnable and independently verifiable. Don't start a phase
until the previous one's acceptance criteria are met.

**Phase 0 — Scaffold & live deploy**
Scaffold the stack (§3), wire `adapter-static`, add `CNAME` + `.nojekyll`, prerender,
and the GH Actions workflow. Deploy a placeholder page.
_Acceptance:_ pushing to `main` deploys, and the subdomain serves the live page over CI.

**Phase 1 — Engine core & primitives (no UI)**
Implement `types`, `card`, `deck`, `rng`, `pile`, `session`, and the `GameDefinition`
interface. Drive everything with Vitest.
_Acceptance:_ a full game can be simulated headlessly in tests (deal → moves → win);
same seed → identical deal; undo replays correctly.

**Phase 2 — Render & interaction shell (game-agnostic)**
`Table`, `CardView` (with flip), `Pile`, and the `dnd` pointer layer. FLIP animation for
cards moving between piles, keyed on card `id`.
_Acceptance:_ can drag a card/run with smooth 60fps animation and correct snap/spring-back
on **both** desktop and a real phone; legal targets highlight.

**Phase 3 — Klondike, fully wired (reference game)**
First complete game through the entire stack: deal, draw, tableau builds, foundations,
win detection, new-deal, undo. This is the template every later game is built against.
_Acceptance:_ Klondike is playable and winnable end-to-end on mobile and desktop, with
working undo and new-deal.

**Phase 4 — Catalog/home & registry**
Home screen reads `registry.ts` and renders a responsive game grid; routing to
`/play/[gameId]`; back-to-catalog.
_Acceptance:_ navigate catalog ↔ game cleanly; catalog grid looks good on a phone;
adding a game to the registry makes it appear with no other changes.

**Phase 5 — Second game & polish**
Add a second game (**FreeCell** or **Spider**) to prove the abstraction holds, plus motion
polish, theming, and the cute aesthetic pass.
_Acceptance:_ the second game is added **without modifying the engine or shell**; deal/flip/
move animations feel satisfying; overall look reads as warm and cute, not utilitarian.

## 11. First Game Spec — Klondike

Standard draw-3 (configurable to draw-1) Klondike: 7 tableau columns (1..7 cards, top
face-up), 4 foundations (build up by suit A→K), stock + waste, win when all 52 reach
foundations. Tableau builds down in alternating colors; movable runs; only Kings to empty
columns. Use this to exercise: face-down→face-up flips on column reveal, multi-card run
drags, double-tap-to-foundation (`autoMove`), and auto-complete cascade when the board is
solved-but-unstacked.

## 12. Conventions

- **TypeScript strict**; no `any` in engine code. Engine modules import nothing from
  `svelte`/DOM.
- **Vitest** covers all game logic; a new game ships with its `*.test.ts`.
- Pointer Events only for interaction (no separate mouse/touch branches).
- Prettier + ESLint clean before commit; conventional-commit messages.
- Keep `localStorage` access behind a wrapper module.
- Small, reviewable PRs/commits aligned to the phases above.

## 13. Non-Goals (out of scope)

- No backend, server, database, or runtime network calls.
- No user accounts, auth, or cloud sync.
- No multiplayer.
- No real-money play, wagering, or gambling mechanics.
- No PWA/offline-install in v1 (candidate stretch goal, not now).

## 14. Open Questions (surface to human — don't guess)

1. **Subdomain:** exact hostname for the `CNAME` file?
2. **Card art:** preferred SVG deck set / license to commit? Any aesthetic direction
   (classic vs. modern vs. custom-cute)?
3. **Catalog scope:** initial target list of games beyond Klondike (FreeCell, Spider,
   Pyramid, TriPeaks, Golf, Yukon…)? Rough priority order?
4. **Daily challenge / shareable seeds:** in scope for v1 or later?
5. **Theme:** light/dark, multiple felt colors, or a single signature look first?
