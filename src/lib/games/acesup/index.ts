/**
 * Aces Up — a quick "discarder". Four columns; tap the stock to deal one card
 * to each. Discard a column's top card when another column shows a higher card
 * of the SAME suit (Aces are high). Drag a top card to an empty column. Win by
 * clearing everything down to the four Aces.
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
import { tableauId, topCard } from '../shared';

export interface AcesUpState {
	readonly columns: readonly (readonly Card[])[]; // 4
	readonly stock: readonly Card[];
}

export type AcesUpMove =
	{ type: 'deal' } | { type: 'discard'; col: number } | { type: 'move'; from: number; to: number };

const COLS = 4;
const stockId = 'stock';
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

/** Aces are high. */
function value(card: Card): number {
	return card.rank === 1 ? 14 : card.rank;
}

/** A column's top is removable if another column shows a higher same-suit card. */
function removable(state: AcesUpState, col: number): boolean {
	const t = topCard(state.columns[col]);
	if (!t) return false;
	return state.columns.some((c, j) => {
		if (j === col) return false;
		const o = topCard(c);
		return !!o && o.suit === t.suit && value(o) > value(t);
	});
}

export function makeAcesUp(): Game<AcesUpState, AcesUpMove> {
	const definition: GameDefinition<AcesUpState, AcesUpMove> = {
		meta: {
			id: 'acesup',
			name: 'Aces Up',
			blurb: 'Discard down to the four Aces.',
			difficulty: 'medium',
			family: 'discarder',
			howTo: [
				'Tap the stock to deal one card to each of the four columns.',
				'Discard a column’s top card if another column shows a higher card of the same suit.',
				'Aces are high — they can never be discarded.',
				'Drag a top card onto an empty column to free a buried card.',
				'You win when only the four Aces remain.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Aces_Up'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed).map((c) => setFaceUp(c, true));
			const columns: Card[][] = Array.from({ length: COLS }, (_, i) => [deck[i]]);
			return { columns, stock: deck.slice(COLS) };
		},

		legalMoves(state) {
			const moves: AcesUpMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'deal' });
			state.columns.forEach((_, i) => {
				if (removable(state, i)) moves.push({ type: 'discard', col: i });
			});
			state.columns.forEach((col, from) => {
				if (col.length === 0) return;
				state.columns.forEach((dest, to) => {
					if (to !== from && dest.length === 0) moves.push({ type: 'move', from, to });
				});
			});
			return moves;
		},

		applyMove(state, move) {
			switch (move.type) {
				case 'deal': {
					if (state.stock.length === 0) return state;
					const dealt = state.stock.slice(0, COLS);
					return {
						columns: state.columns.map((c, i) => (dealt[i] ? [...c, dealt[i]] : c)),
						stock: state.stock.slice(COLS)
					};
				}
				case 'discard': {
					if (!removable(state, move.col)) return state;
					return {
						...state,
						columns: state.columns.map((c, i) => (i === move.col ? c.slice(0, -1) : c))
					};
				}
				case 'move': {
					const card = topCard(state.columns[move.from]);
					if (!card || state.columns[move.to].length > 0) return state;
					return {
						...state,
						columns: state.columns.map((c, i) => {
							if (i === move.from) return c.slice(0, -1);
							if (i === move.to) return [card];
							return c;
						})
					};
				}
			}
		},

		isWon(state) {
			return (
				state.stock.length === 0 && state.columns.every((c) => c.length === 1 && c[0].rank === 1)
			);
		},

		hint(state) {
			return this.legalMoves(state).find((m) => m.type === 'discard') ?? null;
		}
	};

	const presenter: GamePresenter<AcesUpState, AcesUpMove> = {
		layout(): TableLayout {
			return {
				columns: COLS,
				rows: 5,
				slots: [
					{ pileId: stockId, x: 1.5, y: 0 },
					...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.2 }))
				]
			};
		},

		piles(state): PileView[] {
			const out: PileView[] = [
				{ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' }
			];
			state.columns.forEach((col, i) =>
				out.push({ id: tableauId(i), kind: 'tableau', cards: col, fan: 'down' })
			);
			return out;
		},

		grab(state, pileId, cardId) {
			if (!pileId.startsWith('tableau-')) return null;
			const col = state.columns[parseIndex(pileId)];
			const t = topCard(col);
			return t && t.id === cardId ? [t] : null;
		},

		dropTargets(state, fromPileId, cardId) {
			if (!this.grab(state, fromPileId, cardId)) return [];
			const targets: string[] = [];
			state.columns.forEach((c, i) => {
				if (tableauId(i) !== fromPileId && c.length === 0) targets.push(tableauId(i));
			});
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			if (!this.grab(state, fromPileId, cardId) || !toPileId.startsWith('tableau-')) return null;
			if (state.columns[parseIndex(toPileId)].length > 0) return null;
			return { type: 'move', from: parseIndex(fromPileId), to: parseIndex(toPileId) };
		},

		tap(state, pileId, cardId) {
			if (pileId === stockId) return state.stock.length > 0 ? { type: 'deal' } : null;
			if (pileId.startsWith('tableau-')) {
				const col = parseIndex(pileId);
				const t = topCard(state.columns[col]);
				if (t && t.id === cardId && removable(state, col)) return { type: 'discard', col };
			}
			return null;
		}
	};

	return { definition, presenter };
}

export const acesup = makeAcesUp();
