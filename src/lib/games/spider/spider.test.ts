import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { makeSpider, spider1, spider4, type SpiderState } from './index';

const def = spider4.definition;
const pres = spider4.presenter;
const c = (suit: Suit, rank: Rank, faceUp = true): Card => makeCard(suit, rank, { faceUp });

describe('deck & deal', () => {
	it('1-suit uses 104 unique cards, all spades', () => {
		const s = spider1.definition.initialState(1);
		const all = [...s.tableau.flat(), ...s.stock];
		expect(all).toHaveLength(104);
		expect(new Set(all.map((x) => x.id)).size).toBe(104);
		expect(all.every((x) => x.suit === 'spades')).toBe(true);
	});

	it('4-suit deals 54 to the tableau (sizes 6×4, 5×6) and 50 to the stock', () => {
		const s = def.initialState(7);
		expect(s.tableau.map((col) => col.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
		expect(s.stock).toHaveLength(50);
		expect(s.tableau.every((col) => col[col.length - 1].faceUp)).toBe(true);
	});
});

describe('placement vs movement', () => {
	const base = (tableau: Card[][]): SpiderState => ({ stock: [], foundations: [], tableau });

	it('places a card of one lower rank regardless of suit', () => {
		const state = base([[c('spades', 7)], [c('hearts', 8)], [], [], [], [], [], [], [], []]);
		// 7♠ onto 8♥ — different suits, but placement only checks rank
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});

	it('only moves same-suit descending runs as a group', () => {
		const mixed = base([
			[c('spades', 7), c('hearts', 6)],
			[c('clubs', 8)],
			[],
			[],
			[],
			[],
			[],
			[],
			[],
			[]
		]);
		// 7♠,6♥ is not same-suit → cannot grab the 7
		expect(pres.grab(mixed, 'tableau-0', c('spades', 7).id)).toBeNull();

		const suited = base([
			[c('spades', 7), c('spades', 6)],
			[c('hearts', 8)],
			[],
			[],
			[],
			[],
			[],
			[],
			[],
			[]
		]);
		expect(pres.grab(suited, 'tableau-0', c('spades', 7).id)?.length).toBe(2);
		expect(pres.dropTargets(suited, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});
});

describe('dealing', () => {
	it('adds one card to every column, but only when none is empty', () => {
		const s0 = def.initialState(3);
		const s1 = def.applyMove(s0, { type: 'deal' });
		expect(s1.stock).toHaveLength(40);
		s1.tableau.forEach((col, i) => expect(col.length).toBe(s0.tableau[i].length + 1));

		const withEmpty: SpiderState = {
			stock: [c('spades', 1, false)],
			foundations: [],
			tableau: [[], ...Array.from({ length: 9 }, () => [c('hearts', 2)])]
		};
		expect(def.applyMove(withEmpty, { type: 'deal' })).toBe(withEmpty); // no-op
	});
});

describe('completed runs & winning', () => {
	it('lifts a completed King→Ace same-suit run to a foundation', () => {
		// column 0: a face-down filler, then K..2 of spades; moving the A♠ on top completes it
		const kingToTwo = Array.from({ length: 12 }, (_, i) => c('spades', (13 - i) as Rank));
		const state: SpiderState = {
			stock: [],
			foundations: [],
			tableau: [
				[c('clubs', 5, false), ...kingToTwo],
				[c('spades', 1)],
				[],
				[],
				[],
				[],
				[],
				[],
				[],
				[]
			]
		};
		// move A♠ (rank 1) onto the 2♠ at the top of column 0
		const next = def.applyMove(state, { type: 'move', from: 1, to: 0, count: 1 });
		expect(next.foundations).toHaveLength(1);
		expect(next.foundations[0]).toHaveLength(13);
		expect(next.tableau[0]).toHaveLength(1); // only the filler remains
		expect(next.tableau[0][0].faceUp).toBe(true); // exposed & flipped
	});

	it('isWon when all eight runs are collected', () => {
		const eight = Array.from({ length: 8 }, () => [] as Card[]);
		expect(makeSpider(1).definition.isWon({ stock: [], foundations: eight, tableau: [] })).toBe(
			true
		);
	});
});
