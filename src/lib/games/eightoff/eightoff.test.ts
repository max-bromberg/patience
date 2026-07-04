import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { eightoff, type EightOffState } from './index';

const def = eightoff.definition;
const pres = eightoff.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

const empty = (): EightOffState => ({
	freeCells: [null, null, null, null, null, null, null, null],
	foundations: [[], [], [], []],
	tableau: [[], [], [], [], [], [], [], []]
});

describe('initialState (deal)', () => {
	const s = def.initialState(7);

	it('deals 48 cards face-up across 8 columns of 6', () => {
		expect(s.tableau.map((col) => col.length)).toEqual([6, 6, 6, 6, 6, 6, 6, 6]);
		expect(s.tableau.flat()).toHaveLength(48);
		expect(s.tableau.flat().every((card) => card.faceUp)).toBe(true);
	});

	it('fills exactly 4 of the 8 free cells (cells 0..3), all face-up', () => {
		expect(s.freeCells).toHaveLength(8);
		expect(s.freeCells.slice(0, 4).every((card) => card !== null && card.faceUp)).toBe(true);
		expect(s.freeCells.slice(4)).toEqual([null, null, null, null]);
	});

	it('starts with 4 empty foundations', () => {
		expect(s.foundations).toHaveLength(4);
		expect(s.foundations.flat()).toHaveLength(0);
	});

	it('holds exactly 52 unique card ids', () => {
		const ids = [...s.tableau.flat(), ...s.freeCells.filter((x): x is Card => x !== null)].map(
			(card) => card.id
		);
		expect(ids).toHaveLength(52);
		expect(new Set(ids).size).toBe(52);
	});

	it('is deterministic — same seed → identical deal', () => {
		expect(def.initialState(7)).toEqual(def.initialState(7));
		expect(def.initialState(7)).not.toEqual(def.initialState(8));
	});
});

describe('tableau rules', () => {
	it('builds down in the SAME suit on a non-empty column', () => {
		const state: EightOffState = {
			...empty(),
			tableau: [[c('spades', 8)], [c('spades', 9)], [], [], [], [], [], []]
		};
		// 8♠ onto 9♠ is legal (same suit, descending)
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 8).id)).toContain('tableau-1');
	});

	it('rejects a wrong-suit card on the tableau', () => {
		const state: EightOffState = {
			...empty(),
			tableau: [[c('hearts', 8)], [c('spades', 9)], [], [], [], [], [], []]
		};
		// 8♥ onto 9♠ is NOT legal (different suit)
		expect(pres.dropTargets(state, 'tableau-0', c('hearts', 8).id)).not.toContain('tableau-1');
	});

	it('accepts ONLY a King onto an empty column', () => {
		const kingState: EightOffState = {
			...empty(),
			tableau: [[c('spades', 13)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(kingState, 'tableau-0', c('spades', 13).id)).toContain('tableau-1');

		const nonKingState: EightOffState = {
			...empty(),
			tableau: [[c('spades', 5)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(nonKingState, 'tableau-0', c('spades', 5).id)).not.toContain(
			'tableau-1'
		);
	});

	it('grab returns a same-suit descending run, and null for a broken run', () => {
		const good: EightOffState = {
			...empty(),
			tableau: [[c('spades', 9), c('spades', 8), c('spades', 7)], [], [], [], [], [], [], []]
		};
		expect(pres.grab(good, 'tableau-0', c('spades', 9).id)).toHaveLength(3);

		const broken: EightOffState = {
			...empty(),
			tableau: [[c('spades', 9), c('hearts', 8)], [], [], [], [], [], [], []]
		};
		// grabbing from the 9♠ picks up 9♠+8♥ which is not same-suit → not movable
		expect(pres.grab(broken, 'tableau-0', c('spades', 9).id)).toBeNull();
		// but the lone top 8♥ is a valid 1-card run
		expect(pres.grab(broken, 'tableau-0', c('hearts', 8).id)).toHaveLength(1);
	});
});

describe('foundations', () => {
	it('builds up by suit from the Ace', () => {
		const state: EightOffState = {
			...empty(),
			foundations: [[c('spades', 1)], [], [], []],
			tableau: [[c('spades', 2)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 2).id)).toContain('foundation-0');
		// a 2 of a different suit may not go on the ♠ foundation
		const wrong: EightOffState = {
			...empty(),
			foundations: [[c('spades', 1)], [], [], []],
			tableau: [[c('hearts', 2)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(wrong, 'tableau-0', c('hearts', 2).id)).not.toContain('foundation-0');
	});
});

describe('supermove capacity', () => {
	const filler = c('clubs', 9);
	const run = [c('spades', 7), c('spades', 6)]; // same-suit descending, lands on 8♠

	it('moves only 1 card with no free cells and no empty columns', () => {
		const state: EightOffState = {
			freeCells: [
				c('diamonds', 2),
				c('diamonds', 3),
				c('diamonds', 4),
				c('diamonds', 5),
				c('diamonds', 6),
				c('diamonds', 7),
				c('diamonds', 8),
				c('diamonds', 9)
			],
			foundations: [[], [], [], []],
			tableau: [run, [c('spades', 8)], [filler], [filler], [filler], [filler], [filler], [filler]]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).not.toContain('tableau-1');
	});

	it('moves a 2-card run with one free cell open', () => {
		const state: EightOffState = {
			freeCells: [
				c('diamonds', 2),
				c('diamonds', 3),
				c('diamonds', 4),
				c('diamonds', 5),
				c('diamonds', 6),
				c('diamonds', 7),
				c('diamonds', 8),
				null
			],
			foundations: [[], [], [], []],
			tableau: [run, [c('spades', 8)], [filler], [filler], [filler], [filler], [filler], [filler]]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});
});

describe('free cells', () => {
	it('a tableau top can move to an empty free cell (holds one card)', () => {
		const state: EightOffState = {
			...empty(),
			tableau: [[c('spades', 9)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 9).id)).toContain('free-0');
		const next = def.applyMove(state, { type: 'tableauToFreeCell', col: 0, cell: 0 });
		expect(next.freeCells[0]?.id).toBe(c('spades', 9).id);
		expect(next.tableau[0]).toHaveLength(0);
	});

	it('a full free cell is not a drop target', () => {
		const state: EightOffState = {
			...empty(),
			freeCells: [c('hearts', 4), null, null, null, null, null, null, null],
			tableau: [[c('spades', 9)], [], [], [], [], [], [], []]
		};
		const targets = pres.dropTargets(state, 'tableau-0', c('spades', 9).id);
		expect(targets).not.toContain('free-0');
		expect(targets).toContain('free-1');
	});

	it('freeCellToFoundation works', () => {
		const state: EightOffState = {
			...empty(),
			freeCells: [c('spades', 1), null, null, null, null, null, null, null]
		};
		const next = def.applyMove(state, { type: 'freeCellToFoundation', cell: 0, foundation: 0 });
		expect(next.freeCells[0]).toBeNull();
		expect(next.foundations[0]).toEqual([c('spades', 1)]);
	});

	it('freeCellToTableau works (King onto empty, or same-suit)', () => {
		const state: EightOffState = {
			...empty(),
			freeCells: [c('hearts', 6), null, null, null, null, null, null, null],
			tableau: [[c('hearts', 7)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'free-0', c('hearts', 6).id)).toContain('tableau-0');
		const next = def.applyMove(state, { type: 'freeCellToTableau', cell: 0, to: 0 });
		expect(next.freeCells[0]).toBeNull();
		expect(next.tableau[0]).toEqual([c('hearts', 7), c('hearts', 6)]);
	});
});

describe('applyMove immutability', () => {
	it('does not mutate the input state', () => {
		const state: EightOffState = {
			...empty(),
			tableau: [[c('spades', 5)], [], [], [], [], [], [], []]
		};
		const snapshot = JSON.stringify(state);
		def.applyMove(state, { type: 'tableauToFreeCell', col: 0, cell: 0 });
		expect(JSON.stringify(state)).toBe(snapshot);
	});

	it('tableauToTableau moves the exact run', () => {
		const state: EightOffState = {
			...empty(),
			freeCells: [null, null, null, null, null, null, null, null],
			tableau: [[c('spades', 7), c('spades', 6)], [c('spades', 8)], [], [], [], [], [], []]
		};
		const next = def.applyMove(state, { type: 'tableauToTableau', from: 0, to: 1, count: 2 });
		expect(next.tableau[0]).toHaveLength(0);
		expect(next.tableau[1]).toEqual([c('spades', 8), c('spades', 7), c('spades', 6)]);
	});
});

describe('autoMove & isWon', () => {
	it('sends an Ace from a free cell to a foundation', () => {
		const state: EightOffState = {
			...empty(),
			freeCells: [c('clubs', 1), null, null, null, null, null, null, null]
		};
		const move = def.autoMove?.(state, c('clubs', 1));
		expect(move).toEqual({ type: 'freeCellToFoundation', cell: 0, foundation: 0 });
	});

	it('sends the next foundation card home from a tableau top', () => {
		const state: EightOffState = {
			...empty(),
			foundations: [[c('spades', 1)], [], [], []],
			tableau: [[c('spades', 2)], [], [], [], [], [], [], []]
		};
		const move = def.autoMove?.(state, c('spades', 2));
		expect(move).toEqual({ type: 'tableauToFoundation', col: 0, foundation: 0 });
	});

	it('returns null when a card cannot go home', () => {
		const state: EightOffState = {
			...empty(),
			tableau: [[c('spades', 5)], [], [], [], [], [], [], []]
		};
		expect(def.autoMove?.(state, c('spades', 5))).toBeNull();
	});

	it('detects a win on a near-complete hand-built state', () => {
		const full = (s: Suit, max: number) =>
			Array.from({ length: max }, (_, i) => c(s, (i + 1) as Rank));
		const state: EightOffState = {
			freeCells: [c('clubs', 13), null, null, null, null, null, null, null],
			foundations: [
				full('spades', 13),
				full('hearts', 13),
				full('diamonds', 13),
				full('clubs', 12)
			],
			tableau: [[], [], [], [], [], [], [], []]
		};
		expect(def.isWon(state)).toBe(false);
		const next = def.applyMove(state, { type: 'freeCellToFoundation', cell: 0, foundation: 3 });
		expect(def.isWon(next)).toBe(true);
	});
});

describe('scripted sequence to a foundation', () => {
	it('parks a card, then sends an Ace and Two home', () => {
		let state: EightOffState = {
			...empty(),
			tableau: [[c('spades', 1), c('spades', 5)], [c('spades', 2)], [], [], [], [], [], []]
		};
		// 5♠ blocks the Ace — park it in a free cell
		state = def.applyMove(state, { type: 'tableauToFreeCell', col: 0, cell: 4 });
		expect(state.freeCells[4]?.id).toBe(c('spades', 5).id);
		// Ace♠ → foundation
		const aceMove = def.autoMove?.(state, c('spades', 1));
		expect(aceMove).toEqual({ type: 'tableauToFoundation', col: 0, foundation: 0 });
		state = def.applyMove(state, aceMove!);
		// 2♠ → foundation
		const twoMove = def.autoMove?.(state, c('spades', 2));
		expect(twoMove).toEqual({ type: 'tableauToFoundation', col: 1, foundation: 0 });
		state = def.applyMove(state, twoMove!);
		expect(state.foundations[0]).toEqual([c('spades', 1), c('spades', 2)]);
	});
});

describe('layout & piles', () => {
	it('exposes 8 cells, 4 foundations, 8 tableau slots', () => {
		const layout = pres.layout(def.initialState(1));
		expect(layout.slots).toHaveLength(20);
		expect(layout.columns).toBe(8);
	});

	it('projects piles with the expected kinds', () => {
		const piles = pres.piles(def.initialState(1));
		expect(piles.filter((p) => p.kind === 'free')).toHaveLength(8);
		expect(piles.filter((p) => p.kind === 'foundation')).toHaveLength(4);
		expect(piles.filter((p) => p.kind === 'tableau')).toHaveLength(8);
	});
});
