/**
 * TriPeaks — another tap-based adder, with a three-peak board. Twenty-eight
 * cards form three overlapping pyramids; a card is exposed once the two cards
 * covering it below are gone. Move an exposed card to the waste when it is one
 * rank above OR below the waste card (this time the sequence WRAPS: Ace joins
 * both King and Two). Tap the stock to turn the next card. Clear all 28 to win.
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

export interface TriPeaksState {
	/** 28 board slots by position index; null once cleared. */
	readonly peaks: readonly (Card | null)[];
	readonly stock: readonly Card[];
	readonly waste: readonly Card[];
}

export type TriPeaksMove = { type: 'flip' } | { type: 'play'; index: number };

interface Pos {
	x: number;
	row: number;
}

// Three peaks: rows of 3, 6, 9, and a 10-card base (28 total).
const POSITIONS: readonly Pos[] = [
	{ x: 1.5, row: 0 },
	{ x: 4.5, row: 0 },
	{ x: 7.5, row: 0 },
	{ x: 1, row: 1 },
	{ x: 2, row: 1 },
	{ x: 4, row: 1 },
	{ x: 5, row: 1 },
	{ x: 7, row: 1 },
	{ x: 8, row: 1 },
	{ x: 0.5, row: 2 },
	{ x: 1.5, row: 2 },
	{ x: 2.5, row: 2 },
	{ x: 3.5, row: 2 },
	{ x: 4.5, row: 2 },
	{ x: 5.5, row: 2 },
	{ x: 6.5, row: 2 },
	{ x: 7.5, row: 2 },
	{ x: 8.5, row: 2 },
	{ x: 0, row: 3 },
	{ x: 1, row: 3 },
	{ x: 2, row: 3 },
	{ x: 3, row: 3 },
	{ x: 4, row: 3 },
	{ x: 5, row: 3 },
	{ x: 6, row: 3 },
	{ x: 7, row: 3 },
	{ x: 8, row: 3 },
	{ x: 9, row: 3 }
];

/** The two slots directly covering each slot (empty for the base row). */
const COVERERS: readonly (readonly number[])[] = POSITIONS.map((p) =>
	POSITIONS.reduce<number[]>((acc, q, j) => {
		if (q.row === p.row + 1 && Math.abs(q.x - p.x) === 0.5) acc.push(j);
		return acc;
	}, [])
);

const ROW_STEP = 0.52;
const stockId = 'stock';
const wasteId = 'waste';
const peakId = (i: number) => `peak-${i}`;
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

function top(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

function isExposed(peaks: readonly (Card | null)[], index: number): boolean {
	return COVERERS[index].every((i) => peaks[i] === null);
}

/** One rank apart, wrapping (A–K and A–2). */
function playable(card: Card, wasteTop: Card | undefined): boolean {
	if (!wasteTop) return false;
	const diff = Math.abs(card.rank - wasteTop.rank);
	return diff === 1 || diff === 12;
}

export function makeTriPeaks(): Game<TriPeaksState, TriPeaksMove> {
	const definition: GameDefinition<TriPeaksState, TriPeaksMove> = {
		meta: {
			id: 'tripeaks',
			name: 'TriPeaks',
			blurb: 'Clear three peaks, one rank up or down — Aces wrap around.',
			difficulty: 'medium',
			family: 'adder',
			howTo: [
				'Clear all three peaks (28 cards) to win.',
				'A card is playable once the two cards overlapping it below are gone.',
				'Tap an exposed card to move it to the waste — one rank above or below the waste card.',
				'The sequence wraps: an Ace plays on a King or a Two.',
				'Tap the stock to turn the next card when you are stuck.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Tri_Peaks_(game)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const peaks = deck.slice(0, 28).map((c) => setFaceUp(c, true));
			const waste = [setFaceUp(deck[28], true)];
			const stock = deck.slice(29).map((c) => setFaceUp(c, false));
			return { peaks, stock, waste };
		},

		legalMoves(state) {
			const moves: TriPeaksMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'flip' });
			const w = top(state.waste);
			state.peaks.forEach((card, i) => {
				if (card && isExposed(state.peaks, i) && playable(card, w))
					moves.push({ type: 'play', index: i });
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
			const card = state.peaks[move.index];
			if (!card || !isExposed(state.peaks, move.index) || !playable(card, top(state.waste)))
				return state;
			return {
				...state,
				peaks: state.peaks.map((c, i) => (i === move.index ? null : c)),
				waste: [...state.waste, card]
			};
		},

		isWon(state) {
			return state.peaks.every((c) => c === null);
		},

		isLost(state) {
			if (state.stock.length > 0) return false;
			return this.legalMoves(state).length === 0 && !this.isWon(state);
		}
	};

	const presenter: GamePresenter<TriPeaksState, TriPeaksMove> = {
		layout(): TableLayout {
			const slots = [
				...POSITIONS.map((p, i) => ({ pileId: peakId(i), x: p.x, y: p.row * ROW_STEP })),
				{ pileId: stockId, x: 3.5, y: 2.55 },
				{ pileId: wasteId, x: 5.5, y: 2.55 }
			];
			return { columns: 10, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = POSITIONS.map((_, i) => {
				const card = state.peaks[i];
				return {
					id: peakId(i),
					kind: 'peak',
					cards: card ? [setFaceUp(card, isExposed(state.peaks, i))] : [],
					fan: 'none' as const
				};
			});
			out.push({ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' });
			out.push({ id: wasteId, kind: 'waste', cards: state.waste, fan: 'none', placeholder: '' });
			return out;
		},

		grab: () => null,
		dropTargets: () => [],
		resolveDrop: () => null,

		tap(state, pileId, cardId) {
			if (pileId === stockId) return state.stock.length > 0 ? { type: 'flip' } : null;
			if (pileId.startsWith('peak-')) {
				const index = parseIndex(pileId);
				const card = state.peaks[index];
				if (
					card &&
					card.id === cardId &&
					isExposed(state.peaks, index) &&
					playable(card, top(state.waste))
				)
					return { type: 'play', index };
			}
			return null;
		}
	};

	return { definition, presenter };
}

export const tripeaks = makeTriPeaks();
