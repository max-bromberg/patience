/**
 * Simple Simon — a one-deck cousin of Spider. Ten columns are dealt face up in a
 * triangle (8,8,8,7,6,5,4,3,2,1) and there is NO stock. Build DOWN by rank
 * regardless of suit to place a card, but a group only MOVES if it is a
 * same-suit descending run. Assemble a full King-to-Ace same-suit run and it
 * lifts off to its foundation; clear all four suits to win.
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
import { foundationId, parsePileIndex as parseIndex, tableauId, topCard as top } from '../shared';

export interface SimpleSimonState {
	/** Up to 4 completed King→Ace same-suit runs, one per suit. */
	readonly foundations: readonly (readonly Card[])[];
	/** 10 tableau columns, all face up. */
	readonly tableau: readonly (readonly Card[])[];
}

export type SimpleSimonMove = { type: 'move'; from: number; to: number; count: number };

const COLS = 10;
/** Triangular deal, left→right, summing to 52. */
const DEAL_SIZES: readonly number[] = [8, 8, 8, 7, 6, 5, 4, 3, 2, 1];

/** Placement: any suit, one rank lower; empty column accepts anything. */
function canPlace(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = top(col);
	if (!t) return true;
	return t.rank === bottom.rank + 1;
}

/** Grab a same-suit descending run from `cardId` to the top of its column. */
function grabRun(state: SimpleSimonState, pileId: string, cardId: string): readonly Card[] | null {
	if (!pileId.startsWith('tableau-')) return null;
	const col = state.tableau[parseIndex(pileId)];
	if (!col) return null;
	const idx = col.findIndex((c) => c.id === cardId);
	if (idx < 0) return null;
	const run = col.slice(idx);
	return isDescendingSameSuit(run) ? run : null;
}

/**
 * Lift any completed King→Ace same-suit run off a column's top into its suit's
 * foundation. Loops in case a lift exposes another completed run.
 */
function collectRuns(
	tableau: readonly Card[][],
	foundations: readonly Card[][]
): { tableau: Card[][]; foundations: Card[][] } {
	const cols = tableau.map((c) => c.slice());
	const found = foundations.map((f) => f.slice());
	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < cols.length; i++) {
			const col = cols[i];
			if (col.length < 13) continue;
			const tail = col.slice(col.length - 13);
			const sameSuit = tail.every((c) => c.suit === tail[0].suit);
			const isKtoA = tail.every((c, k) => c.rank === 13 - k);
			if (sameSuit && isKtoA) {
				found.push(tail);
				cols[i] = col.slice(0, col.length - 13);
				changed = true;
			}
		}
	}
	return { tableau: cols, foundations: found };
}

const definition: GameDefinition<SimpleSimonState, SimpleSimonMove> = {
	meta: {
		id: 'simplesimon',
		name: 'Simple Simon',
		blurb: 'One-deck Spider with a friendly triangular deal and no stock to fret over.',
		difficulty: 'hard',
		family: 'builder',
		howTo: [
			'Every card is dealt face up across ten columns — there is no stock.',
			'Build down by rank on the tableau; suit does not matter for placing a card.',
			'You can only pick up a group if it is a same-suit run in sequence.',
			'A single card can always move, including onto an empty column.',
			'Complete a full King-to-Ace run in one suit and it is cleared automatically.',
			'Clear all four suits to win.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Simple_Simon_(card_game)'
	},

	initialState(seed) {
		const deck = shuffledDeck(seed, { faceUp: true });
		const tableau: Card[][] = Array.from({ length: COLS }, () => []);
		let k = 0;
		for (let col = 0; col < COLS; col++) {
			for (let row = 0; row < DEAL_SIZES[col]; row++) {
				tableau[col].push(setFaceUp(deck[k++], true));
			}
		}
		return { foundations: [], tableau };
	},

	legalMoves(state) {
		const moves: SimpleSimonMove[] = [];
		state.tableau.forEach((col, ci) => {
			for (let start = 0; start < col.length; start++) {
				const run = col.slice(start);
				if (!isDescendingSameSuit(run)) continue;
				state.tableau.forEach((dest, di) => {
					if (di !== ci && canPlace(run[0], dest))
						moves.push({ type: 'move', from: ci, to: di, count: run.length });
				});
			}
		});
		return moves;
	},

	applyMove(state, move) {
		const from = state.tableau[move.from];
		if (!from || move.count <= 0 || move.count > from.length) return state;
		const moved = from.slice(from.length - move.count);
		if (!isDescendingSameSuit(moved)) return state;
		if (!canPlace(moved[0], state.tableau[move.to]) || move.from === move.to) return state;
		const tableau = state.tableau.map((col, i) => {
			if (i === move.from) return col.slice(0, col.length - move.count);
			if (i === move.to) return [...col, ...moved];
			return col.slice();
		});
		const settled = collectRuns(tableau, state.foundations as Card[][]);
		return { foundations: settled.foundations, tableau: settled.tableau };
	},

	isWon(state) {
		return state.foundations.length === 4;
	},

	hint(state) {
		const moves = this.legalMoves(state);
		// Prefer a genuine multi-card same-suit run move; else any legal move.
		return moves.find((m) => m.count > 1) ?? moves[0] ?? null;
	}
};

const presenter: GamePresenter<SimpleSimonState, SimpleSimonMove> = {
	layout(): TableLayout {
		const slots = [
			...Array.from({ length: 4 }, (_, i) => ({ pileId: foundationId(i), x: i + 3, y: 0 })),
			...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
		];
		return { columns: COLS, rows: 9, slots };
	},

	piles(state): PileView[] {
		const out: PileView[] = [];
		for (let i = 0; i < 4; i++) {
			const run = state.foundations[i];
			out.push({
				id: foundationId(i),
				kind: 'foundation',
				cards: run ? [run[run.length - 1]] : [],
				fan: 'none',
				placeholder: ''
			});
		}
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
			if (tableauId(i) !== fromPileId && canPlace(run[0], col)) targets.push(tableauId(i));
		});
		return targets;
	},

	resolveDrop(state, fromPileId, cardId, toPileId) {
		const run = grabRun(state, fromPileId, cardId);
		if (!run || !toPileId.startsWith('tableau-')) return null;
		if (!canPlace(run[0], state.tableau[parseIndex(toPileId)])) return null;
		return {
			type: 'move',
			from: parseIndex(fromPileId),
			to: parseIndex(toPileId),
			count: run.length
		};
	}
};

export const simpleSimon: Game<SimpleSimonState, SimpleSimonMove> = { definition, presenter };
