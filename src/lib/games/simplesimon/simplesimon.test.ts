import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { simpleSimon, type SimpleSimonState } from './index';

const def = simpleSimon.definition;
const pres = simpleSimon.presenter;
const c = (suit: Suit, rank: Rank, faceUp = true): Card => makeCard(suit, rank, { faceUp });
const base = (tableau: Card[][]): SimpleSimonState => ({ foundations: [], tableau });
const empties = (n: number): Card[][] => Array.from({ length: n }, () => []);

describe('initialState', () => {
	it('deals the triangular sizes [8,8,8,7,6,5,4,3,2,1]', () => {
		const s = def.initialState(1);
		expect(s.tableau.map((col) => col.length)).toEqual([8, 8, 8, 7, 6, 5, 4, 3, 2, 1]);
	});

	it('uses 52 unique cards, all face up, foundations empty', () => {
		const s = def.initialState(42);
		const all = s.tableau.flat();
		expect(all).toHaveLength(52);
		expect(new Set(all.map((x) => x.id)).size).toBe(52);
		expect(all.every((x) => x.faceUp)).toBe(true);
		expect(s.foundations).toHaveLength(0);
	});

	it('is deterministic given a seed', () => {
		const a = def.initialState(7);
		const b = def.initialState(7);
		expect(a.tableau.flat().map((x) => x.id)).toEqual(b.tableau.flat().map((x) => x.id));
		expect(
			def
				.initialState(8)
				.tableau.flat()
				.map((x) => x.id)
		).not.toEqual(a.tableau.flat().map((x) => x.id));
	});
});

describe('placement rule (any suit) vs move rule (same-suit run)', () => {
	it('grabbing a mixed-suit descending run returns null', () => {
		const state = base([[c('spades', 7), c('hearts', 6)], ...empties(9)]);
		expect(pres.grab(state, 'tableau-0', c('spades', 7).id)).toBeNull();
	});

	it('grabbing a same-suit descending run returns the whole run', () => {
		const state = base([[c('spades', 7), c('spades', 6), c('spades', 5)], ...empties(9)]);
		expect(pres.grab(state, 'tableau-0', c('spades', 7).id)?.length).toBe(3);
	});

	it('a single card is always grabbable regardless of what sits below it', () => {
		const state = base([[c('spades', 7), c('hearts', 6)], ...empties(9)]);
		expect(pres.grab(state, 'tableau-0', c('hearts', 6).id)?.length).toBe(1);
	});
});

describe('placement targets', () => {
	it('placing onto a rank+1 card of a DIFFERENT suit is allowed', () => {
		const state = base([[c('spades', 7)], [c('hearts', 8)], ...empties(8)]);
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});

	it('placing onto a wrong-rank card is not allowed', () => {
		const state = base([[c('spades', 7)], [c('hearts', 9)], ...empties(8)]);
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).not.toContain('tableau-1');
	});

	it('any card may move onto an empty column', () => {
		const state = base([[c('spades', 7)], [], ...empties(8)]);
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});

	it('resolveDrop yields a move mirroring the grabbed run', () => {
		const state = base([[c('spades', 7), c('spades', 6)], [c('hearts', 8)], ...empties(8)]);
		const move = pres.resolveDrop(state, 'tableau-0', c('spades', 7).id, 'tableau-1');
		expect(move).toEqual({ type: 'move', from: 0, to: 1, count: 2 });
	});
});

describe('applyMove', () => {
	it('is immutable — does not mutate the input state', () => {
		const state = base([[c('spades', 7), c('spades', 6)], [c('hearts', 8)], ...empties(8)]);
		const before = state.tableau.map((col) => col.length);
		def.applyMove(state, { type: 'move', from: 0, to: 1, count: 2 });
		expect(state.tableau.map((col) => col.length)).toEqual(before);
		expect(state.foundations).toHaveLength(0);
	});

	it('moves a same-suit run onto a different-suit rank+1 card', () => {
		const state = base([[c('spades', 7), c('spades', 6)], [c('hearts', 8)], ...empties(8)]);
		const next = def.applyMove(state, { type: 'move', from: 0, to: 1, count: 2 });
		expect(next.tableau[0]).toHaveLength(0);
		expect(next.tableau[1].map((x) => x.rank)).toEqual([8, 7, 6]);
	});

	it('rejects an illegal placement (wrong rank) as a no-op', () => {
		const state = base([[c('spades', 7)], [c('hearts', 9)], ...empties(8)]);
		expect(def.applyMove(state, { type: 'move', from: 0, to: 1, count: 1 })).toBe(state);
	});
});

describe('auto-complete of a full suit', () => {
	it('lifts a completed King→Ace same-suit run to its foundation after the move', () => {
		// Column 0 holds K..2 of spades; column 1 holds the A♠. Placing A♠ onto 2♠
		// completes the run, which is cleared automatically.
		const kingToTwo = Array.from({ length: 12 }, (_, i) => c('spades', (13 - i) as Rank));
		const state: SimpleSimonState = {
			foundations: [],
			tableau: [kingToTwo, [c('spades', 1)], ...empties(8)]
		};
		const next = def.applyMove(state, { type: 'move', from: 1, to: 0, count: 1 });
		expect(next.foundations).toHaveLength(1);
		expect(next.foundations[0]).toHaveLength(13);
		expect(next.foundations[0].map((x) => x.rank)).toEqual([
			13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
		]);
		expect(next.tableau[0]).toHaveLength(0);
		expect(next.tableau[1]).toHaveLength(0);
	});

	it('does not lift a full K→A run of MIXED suits after a real move', () => {
		// Column 0: K♠..2♠. Column 1: A♥. Placing A♥ onto 2♠ is legal (any-suit
		// placement) and produces a top-13 K→A that is NOT single-suit, so it stays.
		const kingToTwo = Array.from({ length: 12 }, (_, i) => c('spades', (13 - i) as Rank));
		const state = base([kingToTwo, [c('hearts', 1)], ...empties(8)]);
		const next = def.applyMove(state, { type: 'move', from: 1, to: 0, count: 1 });
		expect(next.foundations).toHaveLength(0);
		expect(next.tableau[0]).toHaveLength(13);
	});

	it('isWon only when all four suits are completed', () => {
		expect(def.isWon(base([]))).toBe(false);
		const threeDone: SimpleSimonState = {
			foundations: [[], [], []] as unknown as readonly (readonly Card[])[],
			tableau: []
		};
		expect(def.isWon(threeDone)).toBe(false);
		const allDone: SimpleSimonState = {
			foundations: [[], [], [], []] as unknown as readonly (readonly Card[])[],
			tableau: []
		};
		expect(def.isWon(allDone)).toBe(true);
	});
});

describe('legalMoves & hint', () => {
	it('lists a same-suit run move and hint prefers a multi-card run', () => {
		const state = base([[c('spades', 7), c('spades', 6)], [c('hearts', 8)], ...empties(8)]);
		const moves = def.legalMoves(state);
		expect(moves).toContainEqual({ type: 'move', from: 0, to: 1, count: 2 });
		expect(def.hint?.(state)).toEqual({ type: 'move', from: 0, to: 1, count: 2 });
	});

	it('hint returns null when no legal move exists', () => {
		// Two isolated singletons with no rank relationship and no empty columns.
		const state = base([[c('spades', 3)], [c('hearts', 7)]]);
		expect(def.hint?.(state)).toBeNull();
	});
});
