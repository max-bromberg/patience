/**
 * Yukon — a Klondike cousin with no stock/waste: all 52 cards are dealt to the
 * tableau, most of them face-up. The twist: you may pick up ANY face-up card
 * together with every card on top of it, even if that group is not an ordered
 * sequence — only the grabbed card itself must land legally (down in alternating
 * color, or a King onto an empty column). Foundations build up A→K by suit.
 */

import {
	isOppositeColor,
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
	canStackOnFoundation as canPlaceOnFoundation,
	flipExposedTop,
	foundationId,
	parsePileIndex as parseIndex,
	tableauId,
	topCard as top
} from '../shared';

export interface YukonState {
	readonly foundations: readonly (readonly Card[])[]; // 4
	readonly tableau: readonly (readonly Card[])[]; // 7
}

export type YukonMove =
	| { type: 'tableauToFoundation'; col: number; foundation: number }
	| { type: 'tableauToTableau'; from: number; to: number; count: number }
	| { type: 'foundationToTableau'; foundation: number; col: number };

const COLS = 7;
const FOUNDATIONS = 4;
/** Face-down cards beneath the 5 face-up in each column (column 0 is special). */
const FACE_DOWN = [0, 1, 2, 3, 4, 5, 6];

/** A grabbed group lands on a column if its bottom card fits (alt-color down, King to empty). */
function canPlaceOnTableau(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = top(col);
	if (!t) return bottom.rank === 13;
	return isOppositeColor(bottom, t) && bottom.rank === t.rank - 1;
}

/** In Yukon any face-up card is grabbable along with everything on top of it. */
function grabRun(state: YukonState, pileId: string, cardId: string): readonly Card[] | null {
	if (!pileId.startsWith('tableau-')) return null;
	const col = state.tableau[parseIndex(pileId)];
	const idx = col.findIndex((c) => c.id === cardId);
	if (idx < 0 || !col[idx].faceUp) return null;
	return col.slice(idx);
}

function withTableau(state: YukonState, changes: Record<number, readonly Card[]>): YukonState {
	return {
		...state,
		tableau: state.tableau.map((col, i) => (i in changes ? flipExposedTop(changes[i]) : col))
	};
}

export function makeYukon(): Game<YukonState, YukonMove> {
	const definition: GameDefinition<YukonState, YukonMove> = {
		meta: {
			id: 'yukon',
			name: 'Yukon',
			blurb: 'Like Klondike, but move any face-up pile — no stock to draw from.',
			difficulty: 'hard',
			family: 'builder',
			howTo: [
				'Build the four foundations up by suit, Ace to King.',
				'Build the tableau down in alternating colors.',
				'Move any face-up card together with every card on top of it — the group need not be in order.',
				'Only the moved card must land legally; only Kings (and their pile) go to an empty column.',
				'There is no stock — every card is already on the table.',
				'Double-tap a card to send it to a foundation.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Yukon_(solitaire)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++) {
				const down = FACE_DOWN[col];
				const total = col === 0 ? 1 : down + 5;
				for (let row = 0; row < total; row++) {
					tableau[col].push(setFaceUp(deck[k++], row >= down));
				}
			}
			return { foundations: Array.from({ length: FOUNDATIONS }, () => []), tableau };
		},

		legalMoves(state) {
			const moves: YukonMove[] = [];
			state.tableau.forEach((col, ci) => {
				const t = top(col);
				if (t && t.faceUp) {
					state.foundations.forEach((f, fi) => {
						if (canPlaceOnFoundation(t, f))
							moves.push({ type: 'tableauToFoundation', col: ci, foundation: fi });
					});
				}
				col.forEach((card, idx) => {
					if (!card.faceUp) return;
					const group = col.slice(idx);
					state.tableau.forEach((dest, di) => {
						if (di !== ci && canPlaceOnTableau(group[0], dest))
							moves.push({ type: 'tableauToTableau', from: ci, to: di, count: group.length });
					});
				});
			});
			state.foundations.forEach((f, fi) => {
				const t = top(f);
				if (!t) return;
				state.tableau.forEach((col, ci) => {
					if (canPlaceOnTableau(t, col))
						moves.push({ type: 'foundationToTableau', foundation: fi, col: ci });
				});
			});
			return moves;
		},

		applyMove(state, move) {
			switch (move.type) {
				case 'tableauToFoundation': {
					const col = state.tableau[move.col];
					const card = top(col);
					if (!card) return state;
					return withTableau(
						{
							...state,
							foundations: state.foundations.map((f, i) =>
								i === move.foundation ? [...f, card] : f
							)
						},
						{ [move.col]: col.slice(0, -1) }
					);
				}
				case 'tableauToTableau': {
					const from = state.tableau[move.from];
					const moved = from.slice(from.length - move.count);
					return withTableau(state, {
						[move.from]: from.slice(0, from.length - move.count),
						[move.to]: [...state.tableau[move.to], ...moved]
					});
				}
				case 'foundationToTableau': {
					const f = state.foundations[move.foundation];
					const card = top(f);
					if (!card) return state;
					return withTableau(
						{
							...state,
							foundations: state.foundations.map((fp, i) =>
								i === move.foundation ? fp.slice(0, -1) : fp
							)
						},
						{ [move.col]: [...state.tableau[move.col], card] }
					);
				}
			}
		},

		isWon(state) {
			return state.foundations.reduce((n, f) => n + f.length, 0) === 52;
		},

		autoMove(state, card) {
			for (let ci = 0; ci < state.tableau.length; ci++) {
				const t = top(state.tableau[ci]);
				if (t && t.id === card.id && t.faceUp) {
					const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(t, f));
					return fi >= 0 ? { type: 'tableauToFoundation', col: ci, foundation: fi } : null;
				}
			}
			return null;
		},

		hint(state) {
			const moves = this.legalMoves(state);
			return moves.find((m) => m.type === 'tableauToFoundation') ?? moves[0] ?? null;
		}
	};

	const presenter: GamePresenter<YukonState, YukonMove> = {
		layout(): TableLayout {
			const slots = [
				...Array.from({ length: FOUNDATIONS }, (_, i) => ({
					pileId: foundationId(i),
					x: i + 3,
					y: 0
				})),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 5, slots };
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
				if (tableauId(i) !== fromPileId && canPlaceOnTableau(run[0], col))
					targets.push(tableauId(i));
			});
			if (run.length === 1) {
				state.foundations.forEach((f, i) => {
					if (canPlaceOnFoundation(run[0], f)) targets.push(foundationId(i));
				});
			}
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return null;
			const from = parseIndex(fromPileId);
			if (
				toPileId.startsWith('tableau-') &&
				canPlaceOnTableau(run[0], state.tableau[parseIndex(toPileId)])
			)
				return { type: 'tableauToTableau', from, to: parseIndex(toPileId), count: run.length };
			if (
				run.length === 1 &&
				toPileId.startsWith('foundation-') &&
				canPlaceOnFoundation(run[0], state.foundations[parseIndex(toPileId)])
			)
				return { type: 'tableauToFoundation', col: from, foundation: parseIndex(toPileId) };
			return null;
		}
	};

	return { definition, presenter };
}

export const yukon = makeYukon();
