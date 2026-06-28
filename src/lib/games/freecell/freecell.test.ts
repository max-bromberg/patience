import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { freecell, type FreeCellState } from './index';

const def = freecell.definition;
const pres = freecell.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

const empty = (): FreeCellState => ({
	freeCells: [null, null, null, null],
	foundations: [[], [], [], []],
	tableau: [[], [], [], [], [], [], [], []]
});

describe('initialState (deal)', () => {
	const s = def.initialState(5);
	it('deals all 52 cards face-up across 8 columns (4×7, 4×6)', () => {
		const sizes = s.tableau.map((col) => col.length);
		expect(sizes).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
		expect(s.tableau.flat().every((card) => card.faceUp)).toBe(true);
		expect(new Set(s.tableau.flat().map((card) => card.id)).size).toBe(52);
	});
	it('starts with empty free cells and foundations', () => {
		expect(s.freeCells).toEqual([null, null, null, null]);
		expect(s.foundations.flat()).toHaveLength(0);
	});
});

describe('tableau rules', () => {
	it('allows ANY card onto an empty column (unlike Klondike)', () => {
		const s = empty();
		const state: FreeCellState = { ...s, tableau: [[c('hearts', 5)], [], [], [], [], [], [], []] };
		expect(pres.dropTargets(state, 'tableau-0', c('hearts', 5).id)).toContain('tableau-1');
	});

	it('builds down in alternating colors on a non-empty column', () => {
		const state: FreeCellState = {
			...empty(),
			tableau: [[c('spades', 6)], [c('hearts', 7)], [], [], [], [], [], []]
		};
		// 6♠ (black) onto 7♥ (red) is legal
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 6).id)).toContain('tableau-1');
	});
});

describe('supermove capacity', () => {
	// run [7♠(black), 6♥(red)] is a valid sequence; it lands on a red 8 (8♥).
	const filler = c('diamonds', 9);
	it('moves only 1 card with no free cells or empty columns', () => {
		const run = [c('spades', 7), c('hearts', 6)];
		const state: FreeCellState = {
			freeCells: [c('clubs', 2), c('clubs', 3), c('clubs', 4), c('clubs', 5)],
			foundations: [[], [], [], []],
			tableau: [run, [c('hearts', 8)], [filler], [filler], [filler], [filler], [filler], [filler]]
		};
		// 7♠ fits on 8♥, but capacity is 1 so the 2-run cannot move
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).not.toContain('tableau-1');
	});

	it('moves a 2-card run with one free cell open', () => {
		const run = [c('spades', 7), c('hearts', 6)];
		const state: FreeCellState = {
			freeCells: [c('clubs', 2), c('clubs', 3), c('clubs', 4), null],
			foundations: [[], [], [], []],
			tableau: [run, [c('hearts', 8)], [filler], [filler], [filler], [filler], [filler], [filler]]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
	});
});

describe('free cells & foundations', () => {
	it('a tableau top can move to an empty free cell', () => {
		const state: FreeCellState = {
			...empty(),
			tableau: [[c('spades', 9)], [], [], [], [], [], [], []]
		};
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 9).id)).toContain('free-0');
		const next = def.applyMove(state, { type: 'tableauToFreeCell', col: 0, cell: 0 });
		expect(next.freeCells[0]?.id).toBe(c('spades', 9).id);
		expect(next.tableau[0]).toHaveLength(0);
	});

	it('a free-cell card can go to a foundation', () => {
		const state: FreeCellState = {
			...empty(),
			freeCells: [c('spades', 1), null, null, null]
		};
		const move = def.autoMove?.(state, c('spades', 1));
		expect(move).toEqual({ type: 'freeCellToFoundation', cell: 0, foundation: 0 });
		const next = def.applyMove(state, move!);
		expect(next.freeCells[0]).toBeNull();
		expect(next.foundations[0]).toHaveLength(1);
	});

	it('reaches a win when the last card reaches a foundation', () => {
		const full = (s: Suit, max: number) =>
			Array.from({ length: max }, (_, i) => c(s, (i + 1) as Rank));
		const state: FreeCellState = {
			freeCells: [c('clubs', 13), null, null, null],
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
