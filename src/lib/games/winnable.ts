/**
 * Winnable-seed selection. PURE — no Svelte/DOM imports, no `any`.
 *
 * Some games ship a "guaranteed winnable" deal mode: instead of dealing a random
 * seed and hoping, we run the generic {@link solve} solver over candidate seeds
 * and hand back the first one it can prove is winnable. Because a proof is an
 * actual winning move list, "guaranteed" here is literal — the returned seed has
 * a concrete solution.
 *
 * Each supported game supplies three things, tuned from measured solve rates:
 *   - a `nodeBudget` (how hard to search a single deal before giving up),
 *   - a `tries` cap (how many consecutive seeds to sample), and
 *   - a compact `key` + a `heuristic` for the solver.
 *
 * The `key` functions are hand-written per game (much cheaper than
 * `JSON.stringify`, and they fold in board symmetries such as interchangeable
 * FreeCell columns to shrink the search). `JSON.stringify` remains the safe
 * generic default for any game without a bespoke key.
 */

import { solve } from '$lib/engine/solver';
import type { Game } from '$lib/engine';
import type { FreeCellState } from './freecell';
import type { GolfState } from './golf';
import type { TriPeaksState } from './tripeaks';
import type { PyramidState } from './pyramid';

/** Per-game solver tuning. `key`/`heuristic` accept `unknown` so heterogeneous
 * game states can live in one registry; each implementation narrows via `as`. */
interface WinnableConfig {
	readonly nodeBudget: number;
	readonly tries: number;
	readonly key: (state: unknown) => string;
	readonly heuristic: (state: unknown) => number;
}

/** Safe generic default key for plain-data states. */
export const jsonKey = (state: unknown): string => JSON.stringify(state);

const cardIds = (cards: readonly { id: string }[]): string => cards.map((c) => c.id).join('.');

const CONFIGS: Readonly<Record<string, WinnableConfig>> = {
	freecell: {
		nodeBudget: 8000,
		tries: 30,
		// Free cells and tableau columns are interchangeable, so sort them: this
		// merges symmetric layouts and roughly halves the branching the solver sees.
		key: (state) => {
			const s = state as FreeCellState;
			const found = s.foundations
				.map((f) => (f.length ? `${f[f.length - 1].suit}${f[f.length - 1].rank}` : '_'))
				.sort()
				.join(',');
			const cells = s.freeCells
				.map((c) => (c ? c.id : '_'))
				.sort()
				.join(',');
			const cols = s.tableau
				.map((c) => cardIds(c))
				.sort()
				.join('/');
			return `${found}|${cells}|${cols}`;
		},
		// Higher = more cards home on the foundations.
		heuristic: (state) => (state as FreeCellState).foundations.reduce((n, f) => n + f.length, 0)
	},

	golf: {
		nodeBudget: 12000,
		tries: 60,
		// Columns are interchangeable → sort. State is pinned by the remaining
		// column cards + the waste's top rank + how much stock is left.
		key: (state) => {
			const s = state as GolfState;
			const cols = s.tableau
				.map((c) => cardIds(c))
				.sort()
				.join('/');
			const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
			return `${s.stock.length}|${wasteTop}|${cols}`;
		},
		// Higher = fewer cards left on the table.
		heuristic: (state) => -(state as GolfState).tableau.reduce((n, c) => n + c.length, 0)
	},

	tripeaks: {
		nodeBudget: 12000,
		tries: 25,
		// Peak slots are positional (not interchangeable) → keep order.
		key: (state) => {
			const s = state as TriPeaksState;
			const board = s.peaks.map((c) => (c ? c.id : '_')).join(',');
			const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
			return `${s.stock.length}|${wasteTop}|${board}`;
		},
		// Higher = more peak cards cleared.
		heuristic: (state) => (state as TriPeaksState).peaks.filter((c) => c === null).length
	},

	pyramid: {
		nodeBudget: 25000,
		tries: 35,
		// Pyramid slots are positional → keep order. Redeal count matters.
		key: (state) => {
			const s = state as PyramidState;
			const board = s.pyramid.map((c) => (c ? c.id : '_')).join(',');
			const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
			return `${board}|${s.stock.length}|${wasteTop}|${s.redealsLeft}`;
		},
		// Higher = more pyramid cards cleared.
		heuristic: (state) => (state as PyramidState).pyramid.filter((c) => c === null).length
	}
};

/** Whether a game id has a winnable-guarantee configuration. */
export function supportsWinnable(gameId: string): boolean {
	return Object.prototype.hasOwnProperty.call(CONFIGS, gameId);
}

/**
 * Find a provably-winnable seed for `game`, scanning `startSeed`, `startSeed+1`,
 * … up to `tries` candidates (defaults to the game's tuned cap). Returns the
 * first seed the solver wins, with `guaranteed: true`. If the game is
 * unsupported, or no candidate is proven within budget, falls back to
 * `{ seed: startSeed, guaranteed: false }`.
 */
export function pickWinnableSeed<S, M>(
	game: Game<S, M>,
	startSeed: number,
	tries?: number
): { seed: number; guaranteed: boolean } {
	const config = CONFIGS[game.definition.meta.id];
	if (config === undefined) return { seed: startSeed, guaranteed: false };

	const maxTries = tries ?? config.tries;
	for (let i = 0; i < maxTries; i++) {
		const seed = startSeed + i;
		const result = solve<S, M>(game.definition, game.definition.initialState(seed), {
			nodeBudget: config.nodeBudget,
			key: config.key,
			heuristic: config.heuristic
		});
		if (result.solved) return { seed, guaranteed: true };
	}
	return { seed: startSeed, guaranteed: false };
}
