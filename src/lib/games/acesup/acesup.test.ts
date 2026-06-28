import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { acesup, type AcesUpState } from './index';

const def = acesup.definition;
const pres = acesup.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

const state = (columns: Card[][], stock: Card[] = []): AcesUpState => ({ columns, stock });

describe('deal', () => {
	it('seeds one card per column and keeps 48 in the stock', () => {
		const s = def.initialState(2);
		expect(s.columns.map((col) => col.length)).toEqual([1, 1, 1, 1]);
		expect(s.stock).toHaveLength(48);
	});

	it('deal adds one card to each column', () => {
		const s = state(
			[[c('hearts', 2)], [c('spades', 3)], [c('clubs', 4)], [c('diamonds', 5)]],
			[c('hearts', 9), c('spades', 9), c('clubs', 9), c('diamonds', 9)]
		);
		const next = def.applyMove(s, { type: 'deal' });
		expect(next.columns.map((col) => col.length)).toEqual([2, 2, 2, 2]);
		expect(next.stock).toHaveLength(0);
	});
});

describe('discarding', () => {
	it('discards a lower card when a higher same-suit card shows', () => {
		// 5♠ can be discarded because K♠ shows in another column
		const s = state([[c('spades', 5)], [c('spades', 13)], [c('hearts', 2)], [c('clubs', 3)]]);
		expect(pres.tap!(s, 'tableau-0', c('spades', 5).id)).toEqual({ type: 'discard', col: 0 });
		const next = def.applyMove(s, { type: 'discard', col: 0 });
		expect(next.columns[0]).toHaveLength(0);
	});

	it('never discards an Ace (Aces are high)', () => {
		const s = state([[c('spades', 1)], [c('spades', 13)], [c('hearts', 2)], [c('clubs', 3)]]);
		expect(pres.tap!(s, 'tableau-0', c('spades', 1).id)).toBeNull();
	});

	it('does not discard without a higher same-suit card', () => {
		const s = state([[c('spades', 5)], [c('hearts', 13)], [c('clubs', 2)], [c('diamonds', 3)]]);
		expect(pres.tap!(s, 'tableau-0', c('spades', 5).id)).toBeNull();
	});
});

describe('moving & winning', () => {
	it('drags a top card onto an empty column', () => {
		const s = state([[c('spades', 5), c('hearts', 7)], [], [c('clubs', 2)], [c('diamonds', 3)]]);
		expect(pres.dropTargets(s, 'tableau-0', c('hearts', 7).id)).toContain('tableau-1');
		const next = def.applyMove(s, { type: 'move', from: 0, to: 1 });
		expect(next.columns[1]).toHaveLength(1);
		expect(next.columns[0]).toHaveLength(1);
	});

	it('wins with only the four Aces left and an empty stock', () => {
		const s = state([[c('spades', 1)], [c('hearts', 1)], [c('diamonds', 1)], [c('clubs', 1)]]);
		expect(def.isWon(s)).toBe(true);
	});
});
