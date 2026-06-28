import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { golf, type GolfState } from './index';

const def = golf.definition;
const pres = golf.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

describe('deal', () => {
	const s = def.initialState(4);
	it('deals 7 columns of 5 face-up cards and 17 to the stock', () => {
		expect(s.tableau.map((col) => col.length)).toEqual([5, 5, 5, 5, 5, 5, 5]);
		expect(s.stock).toHaveLength(17);
		expect(s.waste).toHaveLength(0);
		expect(s.tableau.flat().every((card) => card.faceUp)).toBe(true);
	});
});

describe('playing', () => {
	const base = (tableau: Card[][], waste: Card[]): GolfState => ({ stock: [], waste, tableau });

	it('plays a top card one rank up or down (no wrap)', () => {
		const state = base([[c('hearts', 6)], [c('spades', 8)], [], [], [], [], []], [c('clubs', 7)]);
		// 6 and 8 are both adjacent to 7
		expect(pres.tap!(state, 'tableau-0', c('hearts', 6).id)).toEqual({ type: 'play', col: 0 });
		expect(pres.tap!(state, 'tableau-1', c('spades', 8).id)).toEqual({ type: 'play', col: 1 });
	});

	it('rejects a non-adjacent card and does not wrap K↔A', () => {
		const state = base([[c('hearts', 1)]], [c('clubs', 13)]); // Ace on King — no wrap
		expect(pres.tap!(state, 'tableau-0', c('hearts', 1).id)).toBeNull();
	});

	it('flip moves a stock card to the waste', () => {
		const state: GolfState = {
			stock: [c('diamonds', 3)],
			waste: [],
			tableau: [[], [], [], [], [], [], []]
		};
		const next = def.applyMove(state, { type: 'flip' });
		expect(next.waste).toHaveLength(1);
		expect(next.stock).toHaveLength(0);
	});

	it('wins when every column is empty', () => {
		expect(
			def.isWon({
				stock: [],
				waste: [c('hearts', 5)],
				tableau: Array.from({ length: 7 }, () => [])
			})
		).toBe(true);
	});
});
