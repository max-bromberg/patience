import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { castle, type CastleState } from './index';

const def = castle.definition;
const pres = castle.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

const empty = (): CastleState => ({
	foundations: [[c('spades', 1)], [c('hearts', 1)], [c('diamonds', 1)], [c('clubs', 1)]],
	tableau: [[], [], [], [], [], [], [], []]
});

describe('initialState (deal)', () => {
	const s = def.initialState(7);

	it('seats each Ace on its foundation, in suit order', () => {
		expect(s.foundations.map((f) => f.length)).toEqual([1, 1, 1, 1]);
		expect(s.foundations.map((f) => f[0].suit)).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
		expect(s.foundations.flat().every((card) => card.rank === 1)).toBe(true);
	});

	it('deals 48 cards into 8 columns of 6, all face-up', () => {
		expect(s.tableau).toHaveLength(8);
		expect(s.tableau.map((col) => col.length)).toEqual([6, 6, 6, 6, 6, 6, 6, 6]);
		expect(s.tableau.flat()).toHaveLength(48);
		expect(s.tableau.flat().every((card) => card.faceUp)).toBe(true);
	});

	it('holds 52 unique card ids across foundations and tableau', () => {
		const ids = [...s.foundations.flat(), ...s.tableau.flat()].map((card) => card.id);
		expect(ids).toHaveLength(52);
		expect(new Set(ids).size).toBe(52);
	});

	it('is deterministic for a given seed', () => {
		const a = def.initialState(42);
		const b = def.initialState(42);
		expect(a).toEqual(b);
		const other = def.initialState(43);
		expect(a).not.toEqual(other);
	});
});

describe('tableau rules', () => {
	it('builds DOWN by rank regardless of suit (any 7 on any 8)', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('hearts', 7)], [c('spades', 8)], [], [], [], [], [], []]
		};
		// 7♥ (red) onto 8♠ (black) — suit ignored, only rank matters
		expect(pres.dropTargets(state, 'tableau-0', c('hearts', 7).id)).toContain('tableau-1');
	});

	it('rejects a tableau card that is not exactly one rank below the target', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('hearts', 6)], [c('spades', 8)], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('hearts', 6).id)).not.toContain('tableau-1');
	});

	it('allows ANY card onto an empty column', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('diamonds', 11)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('diamonds', 11).id)).toContain('tableau-1');
	});
});

describe('foundation rules', () => {
	it('accepts the next rank up in the same suit only', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('spades', 2)], [], [], [], [], [], [], []]
		};
		const targets = pres.dropTargets(state, 'tableau-0', c('spades', 2).id);
		// 2♠ builds on the spades Ace (foundation-0) but not on hearts/diamonds/clubs
		expect(targets).toContain('foundation-0');
		expect(targets).not.toContain('foundation-1');
	});

	it('rejects a wrong-suit card onto a foundation', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('hearts', 2)], [], [], [], [], [], [], []]
		};
		const targets = pres.dropTargets(state, 'tableau-0', c('hearts', 2).id);
		expect(targets).toContain('foundation-1'); // hearts Ace
		expect(targets).not.toContain('foundation-0'); // spades Ace
	});
});

describe('single-card constraint', () => {
	it('grabbing a non-top card returns null', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('spades', 9), c('hearts', 5)], [], [], [], [], [], [], []]
		};
		// bottom card is not grabbable
		expect(pres.grab(state, 'tableau-0', c('spades', 9).id)).toBeNull();
		// top card is grabbable
		expect(pres.grab(state, 'tableau-0', c('hearts', 5).id)).toEqual([c('hearts', 5)]);
	});

	it('does not grab from a foundation (terminal)', () => {
		const state = empty();
		expect(pres.grab(state, 'foundation-0', c('spades', 1).id)).toBeNull();
	});
});

describe('applyMove (immutable)', () => {
	it('toFoundation removes the top card and does not mutate input', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('spades', 3), c('spades', 2)], [], [], [], [], [], [], []]
		};
		const snapshot = JSON.parse(JSON.stringify(state));
		const next = def.applyMove(state, { type: 'toFoundation', col: 0, foundation: 0 });
		expect(next.foundations[0]).toHaveLength(2);
		expect(next.foundations[0][1]).toEqual(c('spades', 2));
		expect(next.tableau[0]).toEqual([c('spades', 3)]);
		expect(state).toEqual(snapshot); // untouched
	});

	it('toTableau moves the single top card', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('hearts', 7)], [c('spades', 8)], [], [], [], [], [], []]
		};
		const next = def.applyMove(state, { type: 'toTableau', from: 0, to: 1 });
		expect(next.tableau[0]).toHaveLength(0);
		expect(next.tableau[1]).toEqual([c('spades', 8), c('hearts', 7)]);
	});
});

describe('autoMove', () => {
	it('sends a 2 onto its Ace foundation', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('spades', 2)], [], [], [], [], [], [], []]
		};
		const move = def.autoMove?.(state, c('spades', 2));
		expect(move).toEqual({ type: 'toFoundation', col: 0, foundation: 0 });
		const next = def.applyMove(state, move!);
		expect(next.foundations[0]).toEqual([c('spades', 1), c('spades', 2)]);
	});

	it('returns null when the top card cannot reach a foundation', () => {
		const state: CastleState = {
			...empty(),
			tableau: [[c('spades', 5)], [], [], [], [], [], [], []]
		};
		expect(def.autoMove?.(state, c('spades', 5))).toBeNull();
	});
});

describe('win / loss', () => {
	const fullSuit = (s: Suit) => Array.from({ length: 13 }, (_, i) => c(s, (i + 1) as Rank));

	it('isWon when all 52 cards are on the foundations', () => {
		const state: CastleState = {
			foundations: [
				fullSuit('spades'),
				fullSuit('hearts'),
				fullSuit('diamonds'),
				fullSuit('clubs')
			],
			tableau: [[], [], [], [], [], [], [], []]
		};
		expect(def.isWon(state)).toBe(true);
		expect(def.isLost?.(state)).toBe(false);
	});

	it('isLost on a dead state with no legal moves', () => {
		// Tops are Kings (13) and Jacks (11) — ranks two apart, so no top is exactly one
		// above another (no tableau move). Foundations hold only Aces, so a foundation move
		// would need a 2, and there is none. No empty columns to dump onto. Fully dead.
		const dead: CastleState = {
			foundations: [[c('spades', 1)], [c('hearts', 1)], [c('diamonds', 1)], [c('clubs', 1)]],
			tableau: [
				[c('spades', 3), c('spades', 13)],
				[c('hearts', 3), c('hearts', 13)],
				[c('diamonds', 3), c('diamonds', 13)],
				[c('clubs', 3), c('clubs', 13)],
				[c('spades', 5), c('spades', 11)],
				[c('hearts', 5), c('hearts', 11)],
				[c('diamonds', 5), c('diamonds', 11)],
				[c('clubs', 5), c('clubs', 11)]
			]
		};
		expect(def.legalMoves(dead)).toHaveLength(0);
		expect(def.isLost?.(dead)).toBe(true);
		expect(def.isWon(dead)).toBe(false);
	});
});

describe('layout & piles', () => {
	it('exposes 4 foundations and 8 tableau piles', () => {
		const s = def.initialState(1);
		const piles = pres.piles(s);
		expect(piles.filter((p) => p.kind === 'foundation')).toHaveLength(4);
		expect(piles.filter((p) => p.kind === 'tableau')).toHaveLength(8);
		expect(piles.filter((p) => p.kind === 'tableau').every((p) => p.fan === 'down')).toBe(true);
		const layout = pres.layout(s);
		expect(layout.slots).toHaveLength(12);
	});
});
