import { describe, expect, it } from 'vitest';
import { solve } from '$lib/engine/solver';
import type { Game, GameDefinition } from '$lib/engine';
import { pickWinnableSeed, supportsWinnable } from './winnable';
import { freecell, type FreeCellState, type FreeCellMove } from './freecell';
import { golf, type GolfState, type GolfMove } from './golf';
import { tripeaks, type TriPeaksState, type TriPeaksMove } from './tripeaks';
import { pyramid, type PyramidState, type PyramidMove } from './pyramid';

/**
 * Independent verification helpers. `pickWinnableSeed` only hands back a seed +
 * a boolean, so to prove the seed is *genuinely* winnable we re-solve it here
 * (with a generous budget and a key/heuristic mirroring the production config)
 * and REPLAY the resulting move list through applyMove, asserting it reaches
 * isWon. That closes the loop: "guaranteed" is checked, not trusted.
 */

const cardIds = (cards: readonly { id: string }[]): string => cards.map((c) => c.id).join('.');

interface Verifier<S, M> {
	readonly game: Game<S, M>;
	readonly budget: number;
	readonly key: (s: S) => string;
	readonly heuristic: (s: S) => number;
}

const freecellV: Verifier<FreeCellState, FreeCellMove> = {
	game: freecell,
	budget: 30000,
	key: (s) => {
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
	heuristic: (s) => s.foundations.reduce((n, f) => n + f.length, 0)
};

const golfV: Verifier<GolfState, GolfMove> = {
	game: golf,
	budget: 40000,
	key: (s) => {
		const cols = s.tableau
			.map((c) => cardIds(c))
			.sort()
			.join('/');
		const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
		return `${s.stock.length}|${wasteTop}|${cols}`;
	},
	heuristic: (s) => -s.tableau.reduce((n, c) => n + c.length, 0)
};

const tripeaksV: Verifier<TriPeaksState, TriPeaksMove> = {
	game: tripeaks,
	budget: 30000,
	key: (s) => {
		const board = s.peaks.map((c) => (c ? c.id : '_')).join(',');
		const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
		return `${s.stock.length}|${wasteTop}|${board}`;
	},
	heuristic: (s) => s.peaks.filter((c) => c === null).length
};

const pyramidV: Verifier<PyramidState, PyramidMove> = {
	game: pyramid,
	budget: 60000,
	key: (s) => {
		const board = s.pyramid.map((c) => (c ? c.id : '_')).join(',');
		const wasteTop = s.waste.length ? s.waste[s.waste.length - 1].id : '_';
		return `${board}|${s.stock.length}|${wasteTop}|${s.redealsLeft}`;
	},
	heuristic: (s) => s.pyramid.filter((c) => c === null).length
};

/** Assert `seed` is genuinely winnable for `v.game` by replaying a real solution. */
function assertGenuinelyWinnable<S, M>(v: Verifier<S, M>, seed: number): void {
	const def: GameDefinition<S, M> = v.game.definition;
	const initial = def.initialState(seed);
	const result = solve(def, initial, { nodeBudget: v.budget, key: v.key, heuristic: v.heuristic });
	expect(result.solved).toBe(true);
	expect(result.solution.length).toBeGreaterThan(0);

	// Replay the concrete move list from scratch and require a win.
	let state = def.initialState(seed);
	for (const move of result.solution) state = def.applyMove(state, move);
	expect(def.isWon(state)).toBe(true);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VERIFIERS: Verifier<any, any>[] = [freecellV, golfV, tripeaksV, pyramidV];

describe('supportsWinnable', () => {
	it('reports the configured games and nothing else', () => {
		for (const v of VERIFIERS) expect(supportsWinnable(v.game.definition.meta.id)).toBe(true);
		expect(supportsWinnable('klondike')).toBe(false);
		expect(supportsWinnable('spider')).toBe(false);
		// Must not be fooled by Object.prototype keys.
		expect(supportsWinnable('toString')).toBe(false);
		expect(supportsWinnable('constructor')).toBe(false);
	});
});

describe('pickWinnableSeed', () => {
	it('falls back to guaranteed:false for an unsupported game', () => {
		const fake: Game<{ x: number }, { type: 'noop' }> = {
			definition: {
				meta: { id: 'nope', name: 'Nope', blurb: '', difficulty: 'easy', family: 'test' },
				initialState: () => ({ x: 0 }),
				legalMoves: () => [],
				applyMove: (s) => s,
				isWon: () => false
			},
			// presenter is irrelevant to pickWinnableSeed; a minimal stub keeps types happy.
			presenter: {
				layout: () => ({ columns: 1, rows: 1, slots: [] }),
				piles: () => [],
				grab: () => null,
				dropTargets: () => [],
				resolveDrop: () => null
			}
		};
		expect(pickWinnableSeed(fake, 7)).toEqual({ seed: 7, guaranteed: false });
	});

	for (const v of VERIFIERS) {
		const id = v.game.definition.meta.id;
		it(`finds genuinely-winnable seeds for ${id} across several start seeds`, () => {
			for (const start of [1, 100, 400]) {
				const picked = pickWinnableSeed(v.game, start);
				expect(picked.guaranteed).toBe(true);
				expect(picked.seed).toBeGreaterThanOrEqual(start);
				// The headline guarantee: the seed really is winnable.
				assertGenuinelyWinnable(v, picked.seed);
			}
		}, 60000);
	}

	it('completes a pick quickly for every supported game (loose CI bound)', () => {
		for (const v of VERIFIERS) {
			const t0 = performance.now();
			const picked = pickWinnableSeed(v.game, 1);
			const ms = performance.now() - t0;
			expect(picked.guaranteed).toBe(true);
			// Typical is well under ~250ms on a laptop; this loose bound is
			// generous enough to stay green on slower CI hardware.
			expect(ms).toBeLessThan(5000);
		}
	}, 60000);
});
