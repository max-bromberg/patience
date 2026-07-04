/**
 * Baker's Dozen — a builder with no stock, no free cells, and one famously
 * unforgiving rule: empty columns stay empty forever. Thirteen columns of four
 * face-up cards; kings are sunk to the bottom of their column at the deal so
 * they can't permanently bury the cards beneath them. Foundations build up by
 * suit A→K; the tableau builds down by rank regardless of suit, one card at a
 * time.
 */

import {
	setFaceUp,
	shuffledDeck,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type TableLayout
} from '$lib/engine';
import {
	canStackOnFoundation as canPlaceOnFoundation,
	emptyFoundations,
	foundationId,
	parsePileIndex as parseIndex,
	tableauId,
	topCard as top
} from '../shared';

export interface BakersDozenState {
	readonly foundations: readonly (readonly Card[])[]; // 4
	readonly tableau: readonly (readonly Card[])[]; // 13 columns
}

export type BakersDozenMove =
	| { type: 'toFoundation'; col: number; foundation: number }
	| { type: 'toTableau'; from: number; to: number };

const COLS = 13;
const COL_SIZE = 4;
const FOUNDATIONS = 4;
const KING: number = 13;

/**
 * Tableau rule: a single card lands on a column whose top is exactly one rank
 * higher (any suit). Empty columns can NEVER be filled — the defining Baker's
 * Dozen constraint.
 */
function canPlaceOnTableau(card: Card, col: readonly Card[]): boolean {
	const t = top(col);
	if (!t) return false; // empty columns stay empty
	return t.rank === card.rank + 1;
}

/**
 * Sink kings: within a column, move every King to the bottom (start / index 0),
 * preserving the relative order of both the kings and the other cards.
 */
function sinkKings(col: readonly Card[]): Card[] {
	const kings = col.filter((card) => card.rank === KING);
	const rest = col.filter((card) => card.rank !== KING);
	return [...kings, ...rest];
}

export function makeBakersDozen(): Game<BakersDozenState, BakersDozenMove> {
	const definition: GameDefinition<BakersDozenState, BakersDozenMove> = {
		meta: {
			id: 'bakersdozen',
			name: "Baker's Dozen",
			blurb: 'Thirteen columns, no stock, no second chances — every card is in plain sight.',
			difficulty: 'medium',
			family: 'builder',
			howTo: [
				'Build the four foundations up by suit, Ace to King.',
				'Aces are not placed for you — play them up from the tableau.',
				'Build down the tableau by rank, any suit onto any card one higher.',
				'Only the single top card of a column may move.',
				'Kings sink to the bottom of their column when dealt, so they never bury a column for good.',
				'Empty columns stay empty — nothing can be moved onto an empty column.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Baker%27s_Dozen_(card_game)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed).map((card) => setFaceUp(card, true));
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			deck.forEach((card, i) => tableau[Math.floor(i / COL_SIZE)].push(card));
			return {
				foundations: emptyFoundations(FOUNDATIONS),
				tableau: tableau.map(sinkKings)
			};
		},

		legalMoves(state) {
			const moves: BakersDozenMove[] = [];
			state.tableau.forEach((col, ci) => {
				const t = top(col);
				if (!t) return;
				state.foundations.forEach((f, fi) => {
					if (canPlaceOnFoundation(t, f))
						moves.push({ type: 'toFoundation', col: ci, foundation: fi });
				});
				state.tableau.forEach((dest, di) => {
					if (di === ci) return;
					if (canPlaceOnTableau(t, dest)) moves.push({ type: 'toTableau', from: ci, to: di });
				});
			});
			return moves;
		},

		applyMove(state, move) {
			if (move.type === 'toFoundation') {
				const col = state.tableau[move.col];
				const card = top(col);
				if (!card) return state;
				return {
					...state,
					tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c)),
					foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
				};
			}
			// toTableau
			const from = state.tableau[move.from];
			const card = top(from);
			if (!card) return state;
			if (!canPlaceOnTableau(card, state.tableau[move.to])) return state;
			return {
				...state,
				tableau: state.tableau.map((c, i) => {
					if (i === move.from) return c.slice(0, -1);
					if (i === move.to) return [...c, card];
					return c;
				})
			};
		},

		isWon(state) {
			return state.foundations.reduce((n, f) => n + f.length, 0) === 52;
		},

		isLost(state) {
			return this.legalMoves(state).length === 0 && !this.isWon(state);
		},

		autoMove(state, card) {
			for (let col = 0; col < state.tableau.length; col++) {
				const t = top(state.tableau[col]);
				if (t && t.id === card.id) {
					const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(t, f));
					return fi >= 0 ? { type: 'toFoundation', col, foundation: fi } : null;
				}
			}
			return null;
		},

		hint(state) {
			const moves = this.legalMoves(state);
			return (
				moves.find((m) => m.type === 'toFoundation') ??
				moves.find((m) => m.type === 'toTableau') ??
				null
			);
		}
	};

	const presenter: GamePresenter<BakersDozenState, BakersDozenMove> = {
		layout(): TableLayout {
			const slots = [
				...Array.from({ length: FOUNDATIONS }, (_, i) => ({
					pileId: foundationId(i),
					x: i + 4.5,
					y: 0
				})),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 7, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
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

		/** Only the single top card of a column may be grabbed. Foundations are terminal. */
		grab(state, fromPileId, cardId) {
			if (!fromPileId.startsWith('tableau-')) return null;
			const col = state.tableau[parseIndex(fromPileId)];
			const t = top(col);
			return t && t.id === cardId ? [t] : null;
		},

		dropTargets(state, fromPileId, cardId) {
			const run = presenter.grab(state, fromPileId, cardId);
			if (!run) return [];
			const card = run[0];
			const targets: string[] = [];
			state.foundations.forEach((f, i) => {
				if (canPlaceOnFoundation(card, f)) targets.push(foundationId(i));
			});
			state.tableau.forEach((col, i) => {
				if (tableauId(i) === fromPileId) return;
				// canPlaceOnTableau already refuses empty columns.
				if (canPlaceOnTableau(card, col)) targets.push(tableauId(i));
			});
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			if (!presenter.dropTargets(state, fromPileId, cardId).includes(toPileId)) return null;
			const from = parseIndex(fromPileId);
			const toIdx = parseIndex(toPileId);
			if (toPileId.startsWith('foundation-'))
				return { type: 'toFoundation', col: from, foundation: toIdx };
			if (toPileId.startsWith('tableau-')) return { type: 'toTableau', from, to: toIdx };
			return null;
		}
	};

	return { definition, presenter };
}

export const bakersdozen = makeBakersDozen();
