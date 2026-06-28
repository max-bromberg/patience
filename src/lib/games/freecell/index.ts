/**
 * FreeCell — the second game, added WITHOUT touching the engine or render shell
 * (Phase 5 proof). Pure rules + presentation.
 *
 * 8 tableau columns (all cards face-up), 4 free cells (hold one card each),
 * 4 foundations (build up A→K by suit). Tableau builds down in alternating
 * colors; any card may move to an empty column. A "supermove" of a sequence is
 * allowed up to (freeCells + 1) · 2^(emptyColumns) cards.
 */

import {
	isDescendingAltColor,
	isOppositeColor,
	setFaceUp,
	shuffledDeck,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type TableLayout
} from '$lib/engine';

export interface FreeCellState {
	readonly freeCells: readonly (Card | null)[]; // 4
	readonly foundations: readonly (readonly Card[])[]; // 4
	readonly tableau: readonly (readonly Card[])[]; // 8
}

export type FreeCellMove =
	| { type: 'tableauToFoundation'; col: number; foundation: number }
	| { type: 'tableauToFreeCell'; col: number; cell: number }
	| { type: 'tableauToTableau'; from: number; to: number; count: number }
	| { type: 'freeCellToFoundation'; cell: number; foundation: number }
	| { type: 'freeCellToTableau'; cell: number; to: number };

const COLS = 8;
const CELLS = 4;
const FOUNDATIONS = 4;

const cellId = (i: number) => `free-${i}`;
const foundationId = (i: number) => `foundation-${i}`;
const tableauId = (i: number) => `tableau-${i}`;
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

function top(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

/** FreeCell tableau rule: any card lands on an empty column; else alt-color descending. */
function canPlaceOnTableau(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = top(col);
	if (!t) return true; // any card to an empty column
	return isOppositeColor(bottom, t) && bottom.rank === t.rank - 1;
}

function canPlaceOnFoundation(card: Card, foundation: readonly Card[]): boolean {
	const t = top(foundation);
	if (!t) return card.rank === 1;
	return t.suit === card.suit && card.rank === t.rank + 1;
}

/** Max sequence length movable as a supermove. */
function maxSupermove(state: FreeCellState, toEmptyColumn: boolean): number {
	const freeCells = state.freeCells.filter((c) => c === null).length;
	let emptyCols = state.tableau.filter((col) => col.length === 0).length;
	if (toEmptyColumn) emptyCols = Math.max(0, emptyCols - 1);
	return (freeCells + 1) * 2 ** emptyCols;
}

function grabRun(state: FreeCellState, pileId: string, cardId: string): readonly Card[] | null {
	if (pileId.startsWith('free-')) {
		const card = state.freeCells[parseIndex(pileId)];
		return card && card.id === cardId ? [card] : null;
	}
	if (pileId.startsWith('tableau-')) {
		const col = state.tableau[parseIndex(pileId)];
		const idx = col.findIndex((c) => c.id === cardId);
		if (idx < 0) return null;
		const run = col.slice(idx);
		return isDescendingAltColor(run) ? run : null;
	}
	return null; // foundations are terminal
}

export function makeFreeCell(): Game<FreeCellState, FreeCellMove> {
	const definition: GameDefinition<FreeCellState, FreeCellMove> = {
		meta: {
			id: 'freecell',
			name: 'FreeCell',
			blurb: 'Almost always winnable — every card is on the table.',
			difficulty: 'medium',
			family: 'builder',
			howTo: [
				'Build the four foundations up by suit, Ace to King.',
				'Build down the tableau in alternating colors.',
				'The four free cells each hold one card — use them as temporary parking.',
				'Any card may move to an empty column.',
				'Longer sequences move at once only when enough free cells/empty columns are open.',
				'Double-tap a card to send it straight to a foundation.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/FreeCell'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed).map((c) => setFaceUp(c, true));
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			deck.forEach((card, i) => tableau[i % COLS].push(card));
			return {
				freeCells: Array.from({ length: CELLS }, () => null),
				foundations: Array.from({ length: FOUNDATIONS }, () => []),
				tableau
			};
		},

		legalMoves(state) {
			const moves: FreeCellMove[] = [];

			// free cell sources
			state.freeCells.forEach((card, ci) => {
				if (!card) return;
				state.foundations.forEach((f, fi) => {
					if (canPlaceOnFoundation(card, f))
						moves.push({ type: 'freeCellToFoundation', cell: ci, foundation: fi });
				});
				state.tableau.forEach((col, ti) => {
					if (canPlaceOnTableau(card, col))
						moves.push({ type: 'freeCellToTableau', cell: ci, to: ti });
				});
			});

			// tableau sources
			state.tableau.forEach((col, ci) => {
				const t = top(col);
				if (!t) return;
				// top card → foundation / free cell
				state.foundations.forEach((f, fi) => {
					if (canPlaceOnFoundation(t, f))
						moves.push({ type: 'tableauToFoundation', col: ci, foundation: fi });
				});
				const freeCell = state.freeCells.findIndex((c) => c === null);
				if (freeCell >= 0) moves.push({ type: 'tableauToFreeCell', col: ci, cell: freeCell });

				// movable sequences → other columns (supermove-limited)
				const firstOfRun = (() => {
					let i = col.length - 1;
					while (
						i > 0 &&
						isOppositeColor(col[i - 1], col[i]) &&
						col[i - 1].rank === col[i].rank + 1
					)
						i--;
					return i;
				})();
				for (let start = firstOfRun; start < col.length; start++) {
					const run = col.slice(start);
					state.tableau.forEach((dest, di) => {
						if (di === ci) return;
						if (!canPlaceOnTableau(run[0], dest)) return;
						if (run.length <= maxSupermove(state, dest.length === 0))
							moves.push({ type: 'tableauToTableau', from: ci, to: di, count: run.length });
					});
				}
			});

			return moves;
		},

		applyMove(state, move) {
			const cells = () => state.freeCells.slice();
			switch (move.type) {
				case 'tableauToFoundation': {
					const col = state.tableau[move.col];
					const card = top(col);
					if (!card) return state;
					return {
						...state,
						tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c)),
						foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
					};
				}
				case 'tableauToFreeCell': {
					const col = state.tableau[move.col];
					const card = top(col);
					if (!card) return state;
					const fc = cells();
					fc[move.cell] = card;
					return {
						...state,
						freeCells: fc,
						tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c))
					};
				}
				case 'tableauToTableau': {
					const from = state.tableau[move.from];
					const moved = from.slice(from.length - move.count);
					return {
						...state,
						tableau: state.tableau.map((c, i) => {
							if (i === move.from) return c.slice(0, c.length - move.count);
							if (i === move.to) return [...c, ...moved];
							return c;
						})
					};
				}
				case 'freeCellToFoundation': {
					const card = state.freeCells[move.cell];
					if (!card) return state;
					const fc = cells();
					fc[move.cell] = null;
					return {
						...state,
						freeCells: fc,
						foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
					};
				}
				case 'freeCellToTableau': {
					const card = state.freeCells[move.cell];
					if (!card) return state;
					const fc = cells();
					fc[move.cell] = null;
					return {
						...state,
						freeCells: fc,
						tableau: state.tableau.map((c, i) => (i === move.to ? [...c, card] : c))
					};
				}
			}
		},

		isWon(state) {
			return state.foundations.reduce((n, f) => n + f.length, 0) === 52;
		},

		autoMove(state, card) {
			const ci = state.freeCells.findIndex((c) => c?.id === card.id);
			if (ci >= 0) {
				const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(card, f));
				return fi >= 0 ? { type: 'freeCellToFoundation', cell: ci, foundation: fi } : null;
			}
			for (let col = 0; col < state.tableau.length; col++) {
				const t = top(state.tableau[col]);
				if (t && t.id === card.id) {
					const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(t, f));
					return fi >= 0 ? { type: 'tableauToFoundation', col, foundation: fi } : null;
				}
			}
			return null;
		},

		hint(state) {
			const moves = this.legalMoves(state);
			return (
				moves.find((m) => m.type === 'tableauToFoundation' || m.type === 'freeCellToFoundation') ??
				moves.find((m) => m.type === 'tableauToTableau') ??
				null
			);
		}
	};

	const presenter: GamePresenter<FreeCellState, FreeCellMove> = {
		layout(): TableLayout {
			const slots = [
				...Array.from({ length: CELLS }, (_, i) => ({ pileId: cellId(i), x: i, y: 0 })),
				...Array.from({ length: FOUNDATIONS }, (_, i) => ({
					pileId: foundationId(i),
					x: i + 4,
					y: 0
				})),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.45 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
			state.freeCells.forEach((card, i) =>
				out.push({
					id: cellId(i),
					kind: 'free',
					cards: card ? [card] : [],
					fan: 'none',
					placeholder: '○'
				})
			);
			state.foundations.forEach((f, i) =>
				out.push({
					id: foundationId(i),
					kind: 'foundation',
					cards: f,
					fan: 'none',
					placeholder: 'A'
				})
			);
			state.tableau.forEach((col, i) =>
				out.push({ id: tableauId(i), kind: 'tableau', cards: col, fan: 'down' })
			);
			return out;
		},

		grab: grabRun,

		dropTargets(state, fromPileId, cardId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return [];
			const targets: string[] = [];
			const fromCell = fromPileId.startsWith('free-');

			state.tableau.forEach((col, i) => {
				if (tableauId(i) === fromPileId) return;
				if (!canPlaceOnTableau(run[0], col)) return;
				const cap = fromCell ? 1 : maxSupermove(state, col.length === 0);
				if (run.length <= cap) targets.push(tableauId(i));
			});

			if (run.length === 1) {
				state.foundations.forEach((f, i) => {
					if (canPlaceOnFoundation(run[0], f)) targets.push(foundationId(i));
				});
				if (!fromCell) {
					state.freeCells.forEach((c, i) => {
						if (c === null) targets.push(cellId(i));
					});
				}
			}
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return null;
			if (!presenter.dropTargets(state, fromPileId, cardId).includes(toPileId)) return null;

			const toIdx = parseIndex(toPileId);
			if (fromPileId.startsWith('free-')) {
				const cell = parseIndex(fromPileId);
				if (toPileId.startsWith('foundation-'))
					return { type: 'freeCellToFoundation', cell, foundation: toIdx };
				if (toPileId.startsWith('tableau-')) return { type: 'freeCellToTableau', cell, to: toIdx };
				return null;
			}
			if (fromPileId.startsWith('tableau-')) {
				const col = parseIndex(fromPileId);
				if (toPileId.startsWith('foundation-'))
					return { type: 'tableauToFoundation', col, foundation: toIdx };
				if (toPileId.startsWith('free-')) return { type: 'tableauToFreeCell', col, cell: toIdx };
				if (toPileId.startsWith('tableau-'))
					return { type: 'tableauToTableau', from: col, to: toIdx, count: run.length };
			}
			return null;
		}
	};

	return { definition, presenter };
}

export const freecell = makeFreeCell();
