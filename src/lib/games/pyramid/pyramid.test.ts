import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { pyramid, type PyramidState } from './index';

const def = pyramid.definition;
const pres = pyramid.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

function base(pyr: (Card | null)[]): PyramidState {
	return { pyramid: pyr, stock: [], waste: [], selected: null, redealsLeft: 2 };
}

// A pyramid where everything above the base is already cleared, so the 7 base
// cards (indices 21..27) are all exposed.
function baseExposed(baseCards: Card[]): PyramidState {
	const pyr: (Card | null)[] = Array.from({ length: 28 }, () => null);
	baseCards.forEach((card, i) => (pyr[21 + i] = card));
	return base(pyr);
}

describe('deal', () => {
	const s = def.initialState(3);
	it('places 28 cards in the pyramid and 24 in the stock', () => {
		expect(s.pyramid.filter(Boolean)).toHaveLength(28);
		expect(s.stock).toHaveLength(24);
		expect(s.waste).toHaveLength(0);
	});
});

describe('selection & pairing', () => {
	it('first tap selects, highlight reflects it', () => {
		const five = c('hearts', 5);
		const eight = c('spades', 8);
		const state = baseExposed([
			five,
			eight,
			c('clubs', 2),
			c('clubs', 3),
			c('clubs', 4),
			c('clubs', 9),
			c('clubs', 10)
		]);
		const sel = pres.tap!(state, 'pyr-21', five.id);
		expect(sel).toEqual({ type: 'select', cardId: five.id });
		const selected = def.applyMove(state, sel!);
		expect(pres.highlight!(selected)).toEqual([five.id]);
	});

	it('pairs two exposed cards that add to 13', () => {
		const five = c('hearts', 5);
		const eight = c('spades', 8);
		let state = baseExposed([
			five,
			eight,
			c('clubs', 2),
			c('clubs', 3),
			c('clubs', 4),
			c('clubs', 9),
			c('clubs', 10)
		]);
		state = def.applyMove(state, { type: 'select', cardId: five.id });
		const move = pres.tap!(state, 'pyr-22', eight.id);
		expect(move).toEqual({ type: 'pair', a: five.id, b: eight.id });
		const next = def.applyMove(state, move!);
		expect(next.pyramid[21]).toBeNull();
		expect(next.pyramid[22]).toBeNull();
		expect(next.selected).toBeNull();
	});

	it('removes a King on its own', () => {
		const king = c('spades', 13);
		const state = baseExposed([
			king,
			c('clubs', 2),
			c('clubs', 3),
			c('clubs', 4),
			c('clubs', 5),
			c('clubs', 6),
			c('clubs', 7)
		]);
		expect(pres.tap!(state, 'pyr-21', king.id)).toEqual({ type: 'removeKing', cardId: king.id });
	});

	it('does not let a covered card be tapped', () => {
		// apex (idx 0) is covered by idx 1 and 2, which are present
		const s = def.initialState(1);
		const apex = s.pyramid[0]!;
		expect(pres.tap!(s, 'pyr-0', apex.id)).toBeNull();
	});
});

describe('stock & win', () => {
	it('flips a stock card to the waste', () => {
		const state: PyramidState = {
			...base(Array.from({ length: 28 }, () => null)),
			stock: [c('hearts', 9)]
		};
		const next = def.applyMove(state, { type: 'flip' });
		expect(next.waste).toHaveLength(1);
		expect(next.stock).toHaveLength(0);
	});

	it('wins when the pyramid is empty', () => {
		expect(def.isWon(base(Array.from({ length: 28 }, () => null)))).toBe(true);
	});

	it('pairs across the pyramid and the waste top', () => {
		const six = c('hearts', 6);
		const seven = c('spades', 7);
		let state = baseExposed([
			six,
			c('clubs', 2),
			c('clubs', 3),
			c('clubs', 4),
			c('clubs', 9),
			c('clubs', 10),
			c('clubs', 11)
		]);
		state = { ...state, waste: [seven] };
		state = def.applyMove(state, { type: 'select', cardId: seven.id });
		const move = pres.tap!(state, 'pyr-21', six.id);
		expect(move).toEqual({ type: 'pair', a: seven.id, b: six.id });
		const next = def.applyMove(state, move!);
		expect(next.waste).toHaveLength(0);
		expect(next.pyramid[21]).toBeNull();
	});
});
