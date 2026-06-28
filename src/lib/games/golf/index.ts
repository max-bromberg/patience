/**
 * Golf — a tap-based "adder", not a builder. Seven columns of five face-up
 * cards; clear them all onto a single waste pile. You may move a column's top
 * card to the waste whenever it is exactly one rank above or below the waste's
 * top card (no wrap: Aces are low, Kings are high). Tap the stock to turn the
 * next card when you are stuck.
 */

import {
	shuffledDeck,
	setFaceUp,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type TableLayout
} from '$lib/engine';

export interface GolfState {
	readonly stock: readonly Card[];
	readonly waste: readonly Card[];
	readonly tableau: readonly (readonly Card[])[]; // 7 columns
}

export type GolfMove = { type: 'flip' } | { type: 'play'; col: number };

const COLS = 7;
const COL_SIZE = 5;

const stockId = 'stock';
const wasteId = 'waste';
const tableauId = (i: number) => `tableau-${i}`;
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

function top(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

/** One rank apart, no wrap. */
function playable(card: Card, wasteTop: Card | undefined): boolean {
	if (!wasteTop) return false;
	return Math.abs(card.rank - wasteTop.rank) === 1;
}

export function makeGolf(): Game<GolfState, GolfMove> {
	const definition: GameDefinition<GolfState, GolfMove> = {
		meta: {
			id: 'golf',
			name: 'Golf',
			blurb: 'Clear the table onto one pile, one rank up or down at a time.',
			difficulty: 'easy',
			family: 'adder',
			howTo: [
				'Clear all seven columns to win.',
				'Tap a column’s top card to move it to the waste — it must be one rank above or below the waste card.',
				'Aces are low and Kings are high; the sequence does not wrap around.',
				'Tap the stock to turn over the next card when you run out of moves.',
				'There is no undo penalty — plan a long chain before you deal.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Golf_(patience)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++) {
				for (let row = 0; row < COL_SIZE; row++) tableau[col].push(setFaceUp(deck[k++], true));
			}
			const stock = deck.slice(k).map((c) => setFaceUp(c, false)); // 17 cards
			return { stock, waste: [], tableau };
		},

		legalMoves(state) {
			const moves: GolfMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'flip' });
			const w = top(state.waste);
			state.tableau.forEach((col, i) => {
				const t = top(col);
				if (t && playable(t, w)) moves.push({ type: 'play', col: i });
			});
			return moves;
		},

		applyMove(state, move) {
			if (move.type === 'flip') {
				const card = top(state.stock);
				if (!card) return state;
				return {
					...state,
					stock: state.stock.slice(0, -1),
					waste: [...state.waste, setFaceUp(card, true)]
				};
			}
			const col = state.tableau[move.col];
			const card = top(col);
			if (!card || !playable(card, top(state.waste))) return state;
			return {
				...state,
				waste: [...state.waste, card],
				tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c))
			};
		},

		isWon(state) {
			return state.tableau.every((col) => col.length === 0);
		},

		isLost(state) {
			if (state.stock.length > 0) return false;
			return this.legalMoves(state).length === 0 && !this.isWon(state);
		}
	};

	const presenter: GamePresenter<GolfState, GolfMove> = {
		layout(): TableLayout {
			const slots = [
				{ pileId: stockId, x: 2, y: 0 },
				{ pileId: wasteId, x: 4, y: 0 },
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
			out.push({ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' });
			out.push({ id: wasteId, kind: 'waste', cards: state.waste, fan: 'none', placeholder: '' });
			state.tableau.forEach((col, i) =>
				out.push({ id: tableauId(i), kind: 'tableau', cards: col, fan: 'down' })
			);
			return out;
		},

		// Golf is tap-only.
		grab: () => null,
		dropTargets: () => [],
		resolveDrop: () => null,

		tap(state, pileId, cardId) {
			if (pileId === stockId) return state.stock.length > 0 ? { type: 'flip' } : null;
			if (pileId.startsWith('tableau-')) {
				const col = state.tableau[parseIndex(pileId)];
				const t = top(col);
				if (t && t.id === cardId && playable(t, top(state.waste))) {
					return { type: 'play', col: parseIndex(pileId) };
				}
			}
			return null;
		}
	};

	return { definition, presenter };
}

export const golf = makeGolf();
