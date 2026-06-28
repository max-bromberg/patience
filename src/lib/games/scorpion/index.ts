/**
 * Scorpion — a one-deck builder in the Spider spirit, but you move groups
 * Yukon-style. Build DOWN by the SAME suit; you may pick up any face-up card
 * with everything on top of it (the group need not be ordered), as long as the
 * grabbed card lands on a same-suit card one rank higher. Only Kings start an
 * empty column. A three-card stock deals onto the first columns when you are
 * stuck. Win by assembling four complete King-to-Ace suited runs.
 */

import {
	isDescendingSameSuit,
	shuffledDeck,
	setFaceUp,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type TableLayout
} from '$lib/engine';
import { flipExposedTop, tableauId, topCard } from '../shared';

export interface ScorpionState {
	readonly stock: readonly Card[]; // 3 cards, dealt all at once
	readonly tableau: readonly (readonly Card[])[]; // 7 columns
}

export type ScorpionMove =
	{ type: 'deal' } | { type: 'move'; from: number; to: number; count: number };

const COLS = 7;
const stockId = 'stock';
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

function canStack(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = topCard(col);
	if (!t) return bottom.rank === 13; // King to an empty column
	return t.suit === bottom.suit && t.rank === bottom.rank + 1;
}

function grabRun(state: ScorpionState, pileId: string, cardId: string): readonly Card[] | null {
	if (!pileId.startsWith('tableau-')) return null;
	const col = state.tableau[parseIndex(pileId)];
	const idx = col.findIndex((c) => c.id === cardId);
	if (idx < 0 || !col[idx].faceUp) return null;
	return col.slice(idx);
}

function isCompleteRun(col: readonly Card[]): boolean {
	return col.length === 13 && col[0].rank === 13 && isDescendingSameSuit(col);
}

export function makeScorpion(): Game<ScorpionState, ScorpionMove> {
	const definition: GameDefinition<ScorpionState, ScorpionMove> = {
		meta: {
			id: 'scorpion',
			name: 'Scorpion',
			blurb: 'Build four suited King-to-Ace runs — move any pile you like.',
			difficulty: 'hard',
			family: 'builder',
			howTo: [
				'Assemble all four suits into King-to-Ace runs in the columns to win.',
				'Build down within the same suit.',
				'Pick up any face-up card with everything on top — the group need not be in order.',
				'Only a King (with its pile) may move to an empty column.',
				'Tap the stock to deal its three cards onto the first columns when stuck.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Scorpion_(solitaire)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++) {
				for (let row = 0; row < 7; row++) {
					const faceDown = col < 4 && row < 3;
					tableau[col].push(setFaceUp(deck[k++], !faceDown));
				}
			}
			const stock = deck.slice(k).map((c) => setFaceUp(c, false)); // 3 cards
			return { stock, tableau };
		},

		legalMoves(state) {
			const moves: ScorpionMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'deal' });
			state.tableau.forEach((col, ci) => {
				col.forEach((card, idx) => {
					if (!card.faceUp) return;
					const run = col.slice(idx);
					state.tableau.forEach((dest, di) => {
						if (di !== ci && canStack(run[0], dest))
							moves.push({ type: 'move', from: ci, to: di, count: run.length });
					});
				});
			});
			return moves;
		},

		applyMove(state, move) {
			if (move.type === 'deal') {
				if (state.stock.length === 0) return state;
				const tableau = state.tableau.map((col, i) =>
					i < state.stock.length ? [...col, setFaceUp(state.stock[i], true)] : col
				);
				return { stock: [], tableau };
			}
			const from = state.tableau[move.from];
			const moved = from.slice(from.length - move.count);
			const tableau = state.tableau.map((col, i) => {
				if (i === move.from) return flipExposedTop(col.slice(0, col.length - move.count));
				if (i === move.to) return [...col, ...moved];
				return col;
			});
			return { ...state, tableau };
		},

		isWon(state) {
			return state.tableau.filter(isCompleteRun).length === 4;
		},

		hint(state) {
			return this.legalMoves(state).find((m) => m.type === 'move') ?? null;
		}
	};

	const presenter: GamePresenter<ScorpionState, ScorpionMove> = {
		layout(): TableLayout {
			const slots = [
				{ pileId: stockId, x: 6, y: 0 },
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.05 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [
				{ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' }
			];
			state.tableau.forEach((col, i) =>
				out.push({ id: tableauId(i), kind: 'tableau', cards: col, fan: 'down', placeholder: 'K' })
			);
			return out;
		},

		grab: grabRun,

		dropTargets(state, fromPileId, cardId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return [];
			const targets: string[] = [];
			state.tableau.forEach((col, i) => {
				if (tableauId(i) !== fromPileId && canStack(run[0], col)) targets.push(tableauId(i));
			});
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run || !toPileId.startsWith('tableau-')) return null;
			if (!canStack(run[0], state.tableau[parseIndex(toPileId)])) return null;
			return {
				type: 'move',
				from: parseIndex(fromPileId),
				to: parseIndex(toPileId),
				count: run.length
			};
		},

		tap(state, pileId) {
			return pileId === stockId && state.stock.length > 0 ? { type: 'deal' } : null;
		}
	};

	return { definition, presenter };
}

export const scorpion = makeScorpion();
