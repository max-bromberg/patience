/**
 * Beleaguered Castle — a pure open-information "builder". The four Aces start on
 * the foundations; the other 48 cards lie face-up in eight columns of six. Move
 * one top card at a time: build the foundations up by suit (A→K), or build the
 * tableau DOWN by rank ignoring suit (any 7 on any 8). An empty column accepts
 * any card. No stock, no waste, no free cells — everything is on the table.
 */

import {
	setFaceUp,
	shuffledDeck,
	SUITS,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type TableLayout
} from '$lib/engine';
import {
	canStackOnFoundation,
	emptyFoundations,
	foundationId,
	parsePileIndex as parseIndex,
	tableauId,
	topCard as top
} from '../shared';

export interface CastleState {
	readonly foundations: readonly (readonly Card[])[]; // 4, each pre-seeded with an Ace
	readonly tableau: readonly (readonly Card[])[]; // 8 columns
}

export type CastleMove =
	| { type: 'toFoundation'; col: number; foundation: number }
	| { type: 'toTableau'; from: number; to: number };

const COLS = 8;
const COL_SIZE = 6;
const FOUNDATIONS = 4;

/** Tableau rule: any card lands on an empty column; else build strictly down by rank (any suit). */
function canPlaceOnTableau(card: Card, col: readonly Card[]): boolean {
	const t = top(col);
	if (!t) return true; // any card onto an empty column
	return card.rank === t.rank - 1;
}

export function makeCastle(): Game<CastleState, CastleMove> {
	const definition: GameDefinition<CastleState, CastleMove> = {
		meta: {
			id: 'castle',
			name: 'Beleaguered Castle',
			blurb: 'Every card is face-up from the start — patient, pure planning wins the siege.',
			difficulty: 'medium',
			family: 'builder',
			howTo: [
				'The four Aces begin on the foundations; build each up by suit to the King.',
				'The other 48 cards fill eight columns of six, all face-up.',
				'Move only the single top card of a column.',
				'Build the tableau DOWN by rank, ignoring suit — any 7 goes on any 8.',
				'Any card may move onto an empty column.',
				'Double-tap a top card to send it to its foundation when it fits.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Beleaguered_Castle'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed).map((card) => setFaceUp(card, true));
			// Pull the four Aces out and seat each on a foundation (foundation i ↔ SUITS[i]).
			const foundations: Card[][] = emptyFoundations(FOUNDATIONS);
			const rest: Card[] = [];
			for (const card of deck) {
				if (card.rank === 1) {
					foundations[SUITS.indexOf(card.suit)].push(card);
				} else {
					rest.push(card);
				}
			}
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			rest.forEach((card, i) => tableau[Math.floor(i / COL_SIZE)].push(card));
			return { foundations, tableau };
		},

		legalMoves(state) {
			const moves: CastleMove[] = [];
			state.tableau.forEach((col, ci) => {
				const card = top(col);
				if (!card) return;
				state.foundations.forEach((f, fi) => {
					if (canStackOnFoundation(card, f))
						moves.push({ type: 'toFoundation', col: ci, foundation: fi });
				});
				state.tableau.forEach((dest, di) => {
					if (di === ci) return;
					if (canPlaceOnTableau(card, dest)) moves.push({ type: 'toTableau', from: ci, to: di });
				});
			});
			return moves;
		},

		applyMove(state, move) {
			if (move.type === 'toFoundation') {
				const col = state.tableau[move.col];
				const card = top(col);
				if (!card || !canStackOnFoundation(card, state.foundations[move.foundation])) return state;
				return {
					...state,
					tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c)),
					foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
				};
			}
			const from = state.tableau[move.from];
			const card = top(from);
			if (!card || !canPlaceOnTableau(card, state.tableau[move.to])) return state;
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
					const fi = state.foundations.findIndex((f) => canStackOnFoundation(t, f));
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

	const presenter: GamePresenter<CastleState, CastleMove> = {
		layout(): TableLayout {
			// Foundations centered in a row on top; the eight columns fan down below.
			const slots = [
				...Array.from({ length: FOUNDATIONS }, (_, i) => ({
					pileId: foundationId(i),
					x: i + 2,
					y: 0
				})),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 8, slots };
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

		/** Only a column's single top card is grabbable; foundations are terminal. */
		grab(state, fromPileId, cardId) {
			if (!fromPileId.startsWith('tableau-')) return null;
			const col = state.tableau[parseIndex(fromPileId)];
			const t = top(col);
			return t && t.id === cardId ? [t] : null;
		},

		dropTargets(state, fromPileId, cardId) {
			const run = this.grab(state, fromPileId, cardId);
			if (!run) return [];
			const card = run[0];
			const targets: string[] = [];
			state.foundations.forEach((f, i) => {
				if (canStackOnFoundation(card, f)) targets.push(foundationId(i));
			});
			state.tableau.forEach((col, i) => {
				if (tableauId(i) === fromPileId) return;
				if (canPlaceOnTableau(card, col)) targets.push(tableauId(i));
			});
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			if (!this.dropTargets(state, fromPileId, cardId).includes(toPileId)) return null;
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

export const castle = makeCastle();
