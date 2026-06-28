/**
 * Forty Thieves — a demanding two-deck builder. Ten columns of four face-up
 * cards, eight foundations built up A→K by suit, and a stock you turn one card
 * at a time onto the waste (no redeal). The tableau builds DOWN in the SAME
 * suit; any same-suit descending run may be moved together (a relaxed,
 * pleasant variant), and an empty column accepts any card.
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
import {
	canStackOnFoundation,
	emptyFoundations,
	foundationId,
	tableauId,
	topCard
} from '../shared';

export interface FortyThievesState {
	readonly stock: readonly Card[];
	readonly waste: readonly Card[];
	readonly foundations: readonly (readonly Card[])[]; // 8
	readonly tableau: readonly (readonly Card[])[]; // 10
}

export type FortyThievesMove =
	| { type: 'draw' }
	| { type: 'wasteToFoundation'; foundation: number }
	| { type: 'wasteToTableau'; col: number }
	| { type: 'tableauToFoundation'; col: number; foundation: number }
	| { type: 'tableauToTableau'; from: number; to: number; count: number };

const COLS = 10;
const COL_SIZE = 4;
const FOUNDATIONS = 8;
const stockId = 'stock';
const wasteId = 'waste';
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

/** Same-suit, one rank lower; empty column accepts anything. */
function canStack(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = topCard(col);
	if (!t) return true;
	return t.suit === bottom.suit && t.rank === bottom.rank + 1;
}

function grabRun(state: FortyThievesState, pileId: string, cardId: string): readonly Card[] | null {
	if (pileId === wasteId) {
		const t = topCard(state.waste);
		return t && t.id === cardId ? [t] : null;
	}
	if (pileId.startsWith('tableau-')) {
		const col = state.tableau[parseIndex(pileId)];
		const idx = col.findIndex((c) => c.id === cardId);
		if (idx < 0) return null;
		const run = col.slice(idx);
		return isDescendingSameSuit(run) ? run : null;
	}
	return null;
}

export function makeFortyThieves(): Game<FortyThievesState, FortyThievesMove> {
	const definition: GameDefinition<FortyThievesState, FortyThievesMove> = {
		meta: {
			id: 'fortythieves',
			name: 'Forty Thieves',
			blurb: 'A two-deck test of patience — build foundations by suit.',
			difficulty: 'hard',
			family: 'builder',
			howTo: [
				'Build all eight foundations up by suit, Ace to King (two of each).',
				'Build the tableau down within the same suit.',
				'Move a same-suit descending run together; an empty column accepts any card.',
				'Turn the stock one card at a time onto the waste — there is no redeal.',
				'Double-tap a card to send it to a foundation.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Forty_Thieves_(card_game)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed, { decks: 2 }).map((c) => setFaceUp(c, true));
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++)
				for (let row = 0; row < COL_SIZE; row++) tableau[col].push(deck[k++]);
			const stock = deck.slice(k).map((c) => setFaceUp(c, false));
			return { stock, waste: [], foundations: emptyFoundations(FOUNDATIONS), tableau };
		},

		legalMoves(state) {
			const moves: FortyThievesMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'draw' });

			const w = topCard(state.waste);
			if (w) {
				state.foundations.forEach((f, fi) => {
					if (canStackOnFoundation(w, f)) moves.push({ type: 'wasteToFoundation', foundation: fi });
				});
				state.tableau.forEach((col, ci) => {
					if (canStack(w, col)) moves.push({ type: 'wasteToTableau', col: ci });
				});
			}

			state.tableau.forEach((col, ci) => {
				const t = topCard(col);
				if (t) {
					state.foundations.forEach((f, fi) => {
						if (canStackOnFoundation(t, f))
							moves.push({ type: 'tableauToFoundation', col: ci, foundation: fi });
					});
				}
				for (let start = 0; start < col.length; start++) {
					const run = col.slice(start);
					if (!isDescendingSameSuit(run)) continue;
					state.tableau.forEach((dest, di) => {
						if (di !== ci && canStack(run[0], dest))
							moves.push({ type: 'tableauToTableau', from: ci, to: di, count: run.length });
					});
				}
			});
			return moves;
		},

		applyMove(state, move) {
			switch (move.type) {
				case 'draw': {
					const card = topCard(state.stock);
					if (!card) return state;
					return {
						...state,
						stock: state.stock.slice(0, -1),
						waste: [...state.waste, setFaceUp(card, true)]
					};
				}
				case 'wasteToFoundation': {
					const card = topCard(state.waste);
					if (!card) return state;
					return {
						...state,
						waste: state.waste.slice(0, -1),
						foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
					};
				}
				case 'wasteToTableau': {
					const card = topCard(state.waste);
					if (!card) return state;
					return {
						...state,
						waste: state.waste.slice(0, -1),
						tableau: state.tableau.map((c, i) => (i === move.col ? [...c, card] : c))
					};
				}
				case 'tableauToFoundation': {
					const col = state.tableau[move.col];
					const card = topCard(col);
					if (!card) return state;
					return {
						...state,
						tableau: state.tableau.map((c, i) => (i === move.col ? c.slice(0, -1) : c)),
						foundations: state.foundations.map((f, i) => (i === move.foundation ? [...f, card] : f))
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
			}
		},

		isWon(state) {
			return state.foundations.reduce((n, f) => n + f.length, 0) === 104;
		},

		autoMove(state, card) {
			const w = topCard(state.waste);
			if (w && w.id === card.id) {
				const fi = state.foundations.findIndex((f) => canStackOnFoundation(w, f));
				return fi >= 0 ? { type: 'wasteToFoundation', foundation: fi } : null;
			}
			for (let ci = 0; ci < state.tableau.length; ci++) {
				const t = topCard(state.tableau[ci]);
				if (t && t.id === card.id) {
					const fi = state.foundations.findIndex((f) => canStackOnFoundation(t, f));
					return fi >= 0 ? { type: 'tableauToFoundation', col: ci, foundation: fi } : null;
				}
			}
			return null;
		},

		hint(state) {
			const moves = this.legalMoves(state);
			return (
				moves.find((m) => m.type === 'tableauToFoundation' || m.type === 'wasteToFoundation') ??
				moves.find((m) => m.type === 'tableauToTableau') ??
				null
			);
		}
	};

	const presenter: GamePresenter<FortyThievesState, FortyThievesMove> = {
		layout(): TableLayout {
			const slots = [
				{ pileId: stockId, x: 0, y: 0 },
				{ pileId: wasteId, x: 1, y: 0 },
				...Array.from({ length: FOUNDATIONS }, (_, i) => ({
					pileId: foundationId(i),
					x: i + 2,
					y: 0
				})),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
			out.push({ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' });
			out.push({ id: wasteId, kind: 'waste', cards: state.waste, fan: 'none' });
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
			state.tableau.forEach((col, i) => {
				if (tableauId(i) !== fromPileId && canStack(run[0], col)) targets.push(tableauId(i));
			});
			if (run.length === 1) {
				state.foundations.forEach((f, i) => {
					if (canStackOnFoundation(run[0], f)) targets.push(foundationId(i));
				});
			}
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return null;
			const toTableau = toPileId.startsWith('tableau-');
			const toFoundation = toPileId.startsWith('foundation-');
			if (fromPileId === wasteId) {
				if (toTableau && canStack(run[0], state.tableau[parseIndex(toPileId)]))
					return { type: 'wasteToTableau', col: parseIndex(toPileId) };
				if (toFoundation && canStackOnFoundation(run[0], state.foundations[parseIndex(toPileId)]))
					return { type: 'wasteToFoundation', foundation: parseIndex(toPileId) };
				return null;
			}
			const from = parseIndex(fromPileId);
			if (toTableau && canStack(run[0], state.tableau[parseIndex(toPileId)]))
				return { type: 'tableauToTableau', from, to: parseIndex(toPileId), count: run.length };
			if (
				run.length === 1 &&
				toFoundation &&
				canStackOnFoundation(run[0], state.foundations[parseIndex(toPileId)])
			)
				return { type: 'tableauToFoundation', col: from, foundation: parseIndex(toPileId) };
			return null;
		},

		tap(state, pileId) {
			return pileId === stockId && state.stock.length > 0 ? { type: 'draw' } : null;
		}
	};

	return { definition, presenter };
}

export const fortythieves = makeFortyThieves();
