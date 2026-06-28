import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { yukon, type YukonState } from './index';

const def = yukon.definition;
const pres = yukon.presenter;
const c = (suit: Suit, rank: Rank, faceUp = true): Card => makeCard(suit, rank, { faceUp });

describe('initialState (deal)', () => {
	const s = def.initialState(11);

	it('deals 7 columns of sizes 1, 6, 7, 8, 9, 10, 11 using all 52 cards', () => {
		expect(s.tableau.map((col) => col.length)).toEqual([1, 6, 7, 8, 9, 10, 11]);
		expect(new Set(s.tableau.flat().map((card) => card.id)).size).toBe(52);
	});

	it('leaves the bottom of each column face-down (5 face-up on top, except column 0)', () => {
		s.tableau.forEach((col, i) => {
			const faceUp = col.filter((card) => card.faceUp).length;
			expect(faceUp).toBe(i === 0 ? 1 : 5);
		});
	});
});

describe('grabbing groups', () => {
	it('grabs ANY face-up card with everything on top, even out of sequence', () => {
		// 9♠, then 4♥, 2♣ on top — not a valid run, but all grabbable in Yukon
		const col = [c('spades', 9), c('hearts', 4), c('clubs', 2)];
		const state: YukonState = {
			foundations: [[], [], [], []],
			tableau: [col, [c('diamonds', 10)], [], [], [], [], []]
		};
		expect(pres.grab(state, 'tableau-0', c('spades', 9).id)?.length).toBe(3);
		// the grabbed 9♠ (black) lands on 10♦ (red)
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 9).id)).toContain('tableau-1');
	});

	it('cannot grab a face-down card', () => {
		const state: YukonState = {
			foundations: [[], [], [], []],
			tableau: [[c('spades', 9, false), c('hearts', 4)], [], [], [], [], [], []]
		};
		expect(pres.grab(state, 'tableau-0', c('spades', 9, false).id)).toBeNull();
	});
});

describe('rules & winning', () => {
	it('only a King may move to an empty column', () => {
		const state: YukonState = {
			foundations: [[], [], [], []],
			tableau: [[c('clubs', 13)], [c('hearts', 5)], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('clubs', 13).id)).toContain('tableau-2');
		expect(pres.dropTargets(state, 'tableau-1', c('hearts', 5).id)).not.toContain('tableau-2');
	});

	it('auto-flips an exposed face-down card after a move', () => {
		const state: YukonState = {
			foundations: [[], [], [], []],
			tableau: [[c('diamonds', 9, false), c('spades', 6)], [c('hearts', 7)], [], [], [], [], []]
		};
		const next = def.applyMove(state, { type: 'tableauToTableau', from: 0, to: 1, count: 1 });
		expect(next.tableau[0]).toHaveLength(1);
		expect(next.tableau[0][0].faceUp).toBe(true);
	});

	it('reaches a win when the last cards reach the foundations', () => {
		const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
		const upTo = (s: Suit, n: number) => Array.from({ length: n }, (_, i) => c(s, (i + 1) as Rank));
		const state: YukonState = {
			foundations: suits.map((s) => upTo(s, 12)),
			tableau: [
				[c('spades', 13)],
				[c('hearts', 13)],
				[c('diamonds', 13)],
				[c('clubs', 13)],
				[],
				[],
				[]
			]
		};
		expect(def.isWon(state)).toBe(false);
		let st = state;
		for (let i = 0; i < 4; i++)
			st = def.applyMove(st, { type: 'tableauToFoundation', col: i, foundation: i });
		expect(def.isWon(st)).toBe(true);
	});
});
