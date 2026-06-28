import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { scorpion, type ScorpionState } from './index';

const def = scorpion.definition;
const pres = scorpion.presenter;
const c = (suit: Suit, rank: Rank, faceUp = true): Card => makeCard(suit, rank, { faceUp });

const cols = (tableau: Card[][]): ScorpionState => ({
	stock: [],
	tableau: [...tableau, ...Array.from({ length: 7 - tableau.length }, () => [])]
});

describe('deal', () => {
	const s = def.initialState(2);
	it('lays out 7 columns of 7 (49) and a 3-card stock', () => {
		expect(s.tableau.map((col) => col.length)).toEqual([7, 7, 7, 7, 7, 7, 7]);
		expect(s.stock).toHaveLength(3);
	});
	it('makes the first 4 columns start with 3 face-down cards', () => {
		s.tableau.forEach((col, i) => {
			const down = col.filter((card) => !card.faceUp).length;
			expect(down).toBe(i < 4 ? 3 : 0);
		});
	});
});

describe('moving groups', () => {
	it('grabs any face-up card with the group on top (need not be ordered)', () => {
		const col = [c('spades', 9), c('hearts', 4), c('clubs', 2)];
		const state = cols([col, [c('spades', 10)]]);
		expect(pres.grab(state, 'tableau-0', c('spades', 9).id)?.length).toBe(3);
		// 9♠ lands on 10♠ (same suit, one higher)
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 9).id)).toContain('tableau-1');
	});

	it('requires same suit and rejects different suits', () => {
		const state = cols([[c('spades', 9)], [c('hearts', 10)]]);
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 9).id)).not.toContain('tableau-1');
	});

	it('only a King moves to an empty column', () => {
		const state = cols([[c('clubs', 13)], [c('hearts', 5)]]);
		expect(pres.dropTargets(state, 'tableau-0', c('clubs', 13).id)).toContain('tableau-2');
		expect(pres.dropTargets(state, 'tableau-1', c('hearts', 5).id)).not.toContain('tableau-2');
	});

	it('deal drops the 3 stock cards onto the first three columns', () => {
		const state: ScorpionState = {
			stock: [c('spades', 1, false), c('hearts', 2, false), c('clubs', 3, false)],
			tableau: Array.from({ length: 7 }, () => [c('diamonds', 5)])
		};
		const next = def.applyMove(state, { type: 'deal' });
		expect(next.stock).toHaveLength(0);
		expect(next.tableau[0]).toHaveLength(2);
		expect(next.tableau[3]).toHaveLength(1);
		expect(next.tableau[0][1].faceUp).toBe(true);
	});

	it('wins with four complete King-to-Ace suited runs', () => {
		const run = (s: Suit) => Array.from({ length: 13 }, (_, i) => c(s, (13 - i) as Rank));
		const state: ScorpionState = {
			stock: [],
			tableau: [run('spades'), run('hearts'), run('diamonds'), run('clubs'), [], [], []]
		};
		expect(def.isWon(state)).toBe(true);
	});
});
