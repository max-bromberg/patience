import { describe, expect, it } from 'vitest';
import { GameSession, makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { klondike, klondikeDraw1, makeKlondike, type KlondikeState } from './index';

const def = klondike.definition;
const pres = klondike.presenter;

const c = (suit: Suit, rank: Rank, faceUp = true): Card => makeCard(suit, rank, { faceUp });

/** Build A..maxRank of `suit`, face-up (a partial foundation). */
function foundationUpTo(suit: Suit, maxRank: number): Card[] {
	return Array.from({ length: maxRank }, (_, i) => c(suit, (i + 1) as Rank));
}

describe('initialState (deal)', () => {
	const s = def.initialState(123);

	it('deals 7 columns of sizes 1..7 with only the last face-up', () => {
		expect(s.tableau).toHaveLength(7);
		s.tableau.forEach((col, i) => {
			expect(col).toHaveLength(i + 1);
			expect(col[col.length - 1].faceUp).toBe(true);
			expect(col.slice(0, -1).every((card) => !card.faceUp)).toBe(true);
		});
	});

	it('puts the remaining 24 cards in the stock, face-down; waste/foundations empty', () => {
		expect(s.stock).toHaveLength(24);
		expect(s.stock.every((card) => !card.faceUp)).toBe(true);
		expect(s.waste).toHaveLength(0);
		expect(s.foundations.flat()).toHaveLength(0);
	});

	it('uses all 52 distinct cards', () => {
		const ids = [...s.tableau.flat(), ...s.stock].map((card) => card.id);
		expect(new Set(ids).size).toBe(52);
	});

	it('is deterministic for a seed', () => {
		const a = def
			.initialState(7)
			.tableau.flat()
			.map((card) => card.id);
		const b = def
			.initialState(7)
			.tableau.flat()
			.map((card) => card.id);
		expect(a).toEqual(b);
	});
});

describe('stock / waste cycling', () => {
	it('draws drawCount cards face-up onto the waste', () => {
		const s0 = def.initialState(1);
		const s1 = def.applyMove(s0, { type: 'draw' });
		expect(s1.waste).toHaveLength(3);
		expect(s1.waste.every((card) => card.faceUp)).toBe(true);
		expect(s1.stock).toHaveLength(21);
	});

	it('draw-1 variant draws a single card', () => {
		const k1 = klondikeDraw1.definition;
		const s1 = k1.applyMove(k1.initialState(1), { type: 'draw' });
		expect(s1.waste).toHaveLength(1);
		expect(s1.stock).toHaveLength(23);
	});

	it('recycles the waste back into the stock once stock is empty', () => {
		let s = def.initialState(2);
		for (let i = 0; i < 8; i++) s = def.applyMove(s, { type: 'draw' }); // 8×3 = 24
		expect(s.stock).toHaveLength(0);
		expect(s.waste).toHaveLength(24);
		const r = def.applyMove(s, { type: 'recycle' });
		expect(r.stock).toHaveLength(24);
		expect(r.waste).toHaveLength(0);
		expect(r.stock.every((card) => !card.faceUp)).toBe(true);
	});
});

describe('tableau builds & auto-flip', () => {
	it('moving the last face-up card off a column flips the newly exposed card', () => {
		// column 0: [down 9♦, up 6♠]; column 1 top 7♥ so 6♠ can move onto it
		const state: KlondikeState = {
			stock: [],
			waste: [],
			foundations: [[], [], [], []],
			tableau: [[c('diamonds', 9, false), c('spades', 6)], [c('hearts', 7)], [], [], [], [], []],
			drawCount: 3
		};
		const next = def.applyMove(state, { type: 'tableauToTableau', from: 0, to: 1, count: 1 });
		expect(next.tableau[1].map((x) => x.id)).toContain(c('spades', 6).id);
		expect(next.tableau[0]).toHaveLength(1);
		expect(next.tableau[0][0].faceUp).toBe(true); // 9♦ auto-flipped
	});

	it('only Kings may move to an empty column', () => {
		const state: KlondikeState = {
			stock: [],
			waste: [],
			foundations: [[], [], [], []],
			tableau: [[c('clubs', 13)], [c('hearts', 5)], [], [], [], [], []],
			drawCount: 3
		};
		expect(pres.dropTargets(state, 'tableau-0', c('clubs', 13).id)).toContain('tableau-2');
		expect(pres.dropTargets(state, 'tableau-1', c('hearts', 5).id)).not.toContain('tableau-2');
	});

	it('grabs a valid alternating-color run as a unit', () => {
		const run = [c('spades', 7), c('hearts', 6), c('clubs', 5)];
		const state: KlondikeState = {
			stock: [],
			waste: [],
			foundations: [[], [], [], []],
			tableau: [run, [c('diamonds', 8)], [], [], [], [], []],
			drawCount: 3
		};
		expect(pres.grab(state, 'tableau-0', c('spades', 7).id)?.length).toBe(3);
		// the 3-run (bottom 7♠) lands on 8♦
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});
});

describe('foundations & winning', () => {
	it('accepts an Ace then builds up by suit', () => {
		const state: KlondikeState = {
			stock: [],
			waste: [c('spades', 1)],
			foundations: [[], [], [], []],
			tableau: [[], [], [], [], [], [], []],
			drawCount: 3
		};
		const targets = pres.dropTargets(state, 'waste', c('spades', 1).id);
		expect(targets).toContain('foundation-0');
		const s1 = def.applyMove(state, { type: 'wasteToFoundation', foundation: 0 });
		expect(s1.foundations[0]).toHaveLength(1);
	});

	it('reaches a win when the last cards reach the foundations', () => {
		const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
		const state: KlondikeState = {
			stock: [],
			waste: [],
			foundations: suits.map((s) => foundationUpTo(s, 12)), // A..Q ×4 = 48
			tableau: [
				[c('spades', 13)],
				[c('hearts', 13)],
				[c('diamonds', 13)],
				[c('clubs', 13)],
				[],
				[],
				[]
			],
			drawCount: 3
		};
		expect(def.isWon(state)).toBe(false);
		let s = state;
		for (let i = 0; i < 4; i++)
			s = def.applyMove(s, { type: 'tableauToFoundation', col: i, foundation: i });
		expect(def.isWon(s)).toBe(true);
	});
});

describe('autoMove (double-tap to foundation)', () => {
	it('sends an eligible waste card to its foundation', () => {
		const state: KlondikeState = {
			stock: [],
			waste: [c('spades', 2)],
			foundations: [[c('spades', 1)], [], [], []],
			tableau: [[], [], [], [], [], [], []],
			drawCount: 3
		};
		const move = def.autoMove?.(state, c('spades', 2));
		expect(move).toEqual({ type: 'wasteToFoundation', foundation: 0 });
	});

	it('returns null when nothing is playable', () => {
		const state: KlondikeState = {
			stock: [],
			waste: [c('spades', 5)],
			foundations: [[], [], [], []],
			tableau: [[], [], [], [], [], [], []],
			drawCount: 3
		};
		expect(def.autoMove?.(state, c('spades', 5))).toBeNull();
	});
});

describe('session integration (undo)', () => {
	it('undo restores the prior state exactly', () => {
		const session = new GameSession(def, 99);
		const before = JSON.stringify(session.state);
		session.apply({ type: 'draw' });
		expect(JSON.stringify(session.state)).not.toBe(before);
		session.undo();
		expect(JSON.stringify(session.state)).toBe(before);
	});
});

describe('factory metadata', () => {
	it('exposes distinct ids for draw-3 and draw-1', () => {
		expect(makeKlondike(3).definition.meta.id).toBe('klondike');
		expect(makeKlondike(1).definition.meta.id).toBe('klondike-draw1');
	});
});
