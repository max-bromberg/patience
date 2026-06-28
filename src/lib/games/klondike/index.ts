/**
 * Klondike — the reference game. PURE: rules + presentation, no DOM. Standard
 * draw-3 (factory-configurable to draw-1): 7 tableau columns building down in
 * alternating colors, 4 foundations building up by suit A→K, stock + waste,
 * win when all 52 reach the foundations.
 *
 * Conventions: every pile is an array with index 0 = bottom, last = top.
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

export interface KlondikeState {
	readonly stock: readonly Card[]; // face-down
	readonly waste: readonly Card[]; // face-up
	readonly foundations: readonly (readonly Card[])[]; // 4, build up by suit
	readonly tableau: readonly (readonly Card[])[]; // 7 columns
	readonly drawCount: 1 | 3;
}

export type KlondikeMove =
	| { type: 'draw' }
	| { type: 'recycle' }
	| { type: 'wasteToTableau'; col: number }
	| { type: 'wasteToFoundation'; foundation: number }
	| { type: 'tableauToFoundation'; col: number; foundation: number }
	| { type: 'tableauToTableau'; from: number; to: number; count: number }
	| { type: 'foundationToTableau'; foundation: number; col: number };

const COLS = 7;
const FOUNDATIONS = 4;

// --- pile id helpers --------------------------------------------------------
const STOCK = 'stock';
const WASTE = 'waste';
const foundationId = (i: number) => `foundation-${i}`;
const tableauId = (i: number) => `tableau-${i}`;
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

// --- rule helpers -----------------------------------------------------------
function topCard(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

/** A run can land on a tableau column. */
function canPlaceOnTableau(run: readonly Card[], col: readonly Card[]): boolean {
	const bottom = run[0];
	if (!bottom) return false;
	const t = topCard(col);
	if (!t) return bottom.rank === 13; // only Kings to an empty column
	return isOppositeColor(bottom, t) && bottom.rank === t.rank - 1;
}

/** A single card can land on a foundation. */
function canPlaceOnFoundation(card: Card, foundation: readonly Card[]): boolean {
	const t = topCard(foundation);
	if (!t) return card.rank === 1; // Ace starts a foundation
	return t.suit === card.suit && card.rank === t.rank + 1;
}

/** The movable run grabbing `cardId` in a pile, or null if not grabbable. */
function grabRun(state: KlondikeState, pileId: string, cardId: string): readonly Card[] | null {
	if (pileId === WASTE) {
		const t = topCard(state.waste);
		return t && t.id === cardId ? [t] : null;
	}
	if (pileId.startsWith('foundation-')) {
		const f = state.foundations[parseIndex(pileId)];
		const t = topCard(f);
		return t && t.id === cardId ? [t] : null;
	}
	if (pileId.startsWith('tableau-')) {
		const col = state.tableau[parseIndex(pileId)];
		const idx = col.findIndex((c) => c.id === cardId);
		if (idx < 0 || !col[idx].faceUp) return null;
		const run = col.slice(idx);
		return isDescendingAltColor(run) ? run : null;
	}
	return null;
}

// --- immutable state helpers ------------------------------------------------
/** Auto-flip the exposed top of a tableau column face-up. */
function flipExposed(col: readonly Card[]): readonly Card[] {
	const t = topCard(col);
	if (t && !t.faceUp) return [...col.slice(0, -1), setFaceUp(t, true)];
	return col;
}

function withTableau(
	state: KlondikeState,
	changes: Record<number, readonly Card[]>
): KlondikeState {
	const tableau = state.tableau.map((col, i) => (i in changes ? flipExposed(changes[i]) : col));
	return { ...state, tableau };
}

// --- definition factory -----------------------------------------------------
export function makeKlondike(drawCount: 1 | 3): Game<KlondikeState, KlondikeMove> {
	const definition: GameDefinition<KlondikeState, KlondikeMove> = {
		meta: {
			id: drawCount === 1 ? 'klondike-draw1' : 'klondike',
			name: drawCount === 1 ? 'Klondike (Draw 1)' : 'Klondike',
			blurb:
				drawCount === 1
					? 'The classic, in its gentler one-card-draw form.'
					: 'The classic solitaire: build the foundations up by suit.',
			difficulty: drawCount === 1 ? 'easy' : 'medium',
			family: 'builder'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++) {
				for (let row = 0; row <= col; row++) {
					const faceUp = row === col; // only the last card in each column is face-up
					tableau[col].push(setFaceUp(deck[k++], faceUp));
				}
			}
			const stock = deck.slice(k).map((c) => setFaceUp(c, false));
			return {
				stock,
				waste: [],
				foundations: Array.from({ length: FOUNDATIONS }, () => []),
				tableau,
				drawCount
			};
		},

		legalMoves(state) {
			const moves: KlondikeMove[] = [];

			// stock / waste cycling
			if (state.stock.length > 0) moves.push({ type: 'draw' });
			else if (state.waste.length > 0) moves.push({ type: 'recycle' });

			// waste top → foundation / tableau
			const wTop = topCard(state.waste);
			if (wTop) {
				state.foundations.forEach((f, fi) => {
					if (canPlaceOnFoundation(wTop, f))
						moves.push({ type: 'wasteToFoundation', foundation: fi });
				});
				state.tableau.forEach((col, ci) => {
					if (canPlaceOnTableau([wTop], col)) moves.push({ type: 'wasteToTableau', col: ci });
				});
			}

			// tableau → foundation (top card) and tableau → tableau (runs)
			state.tableau.forEach((col, ci) => {
				const t = topCard(col);
				if (t && t.faceUp) {
					state.foundations.forEach((f, fi) => {
						if (canPlaceOnFoundation(t, f))
							moves.push({ type: 'tableauToFoundation', col: ci, foundation: fi });
					});
				}
				// every face-up sub-run that forms a valid sequence
				const firstFaceUp = col.findIndex((c) => c.faceUp);
				if (firstFaceUp >= 0) {
					for (let start = firstFaceUp; start < col.length; start++) {
						const run = col.slice(start);
						if (!isDescendingAltColor(run)) continue;
						state.tableau.forEach((dest, di) => {
							if (di !== ci && canPlaceOnTableau(run, dest))
								moves.push({ type: 'tableauToTableau', from: ci, to: di, count: run.length });
						});
					}
				}
			});

			// foundation top → tableau
			state.foundations.forEach((f, fi) => {
				const t = topCard(f);
				if (!t) return;
				state.tableau.forEach((col, ci) => {
					if (canPlaceOnTableau([t], col))
						moves.push({ type: 'foundationToTableau', foundation: fi, col: ci });
				});
			});

			return moves;
		},

		applyMove(state, move) {
			switch (move.type) {
				case 'draw': {
					const n = Math.min(state.drawCount, state.stock.length);
					if (n === 0) return state;
					const drawn = state.stock.slice(state.stock.length - n).map((c) => setFaceUp(c, true));
					return {
						...state,
						stock: state.stock.slice(0, state.stock.length - n),
						waste: [...state.waste, ...drawn]
					};
				}
				case 'recycle': {
					if (state.stock.length > 0 || state.waste.length === 0) return state;
					const stock = state.waste
						.slice()
						.reverse()
						.map((c) => setFaceUp(c, false));
					return { ...state, stock, waste: [] };
				}
				case 'wasteToTableau': {
					const card = topCard(state.waste);
					if (!card) return state;
					return withTableau(
						{ ...state, waste: state.waste.slice(0, -1) },
						{
							[move.col]: [...state.tableau[move.col], card]
						}
					);
				}
				case 'wasteToFoundation': {
					const card = topCard(state.waste);
					if (!card) return state;
					const foundations = state.foundations.map((f, i) =>
						i === move.foundation ? [...f, card] : f
					);
					return { ...state, waste: state.waste.slice(0, -1), foundations };
				}
				case 'tableauToFoundation': {
					const col = state.tableau[move.col];
					const card = topCard(col);
					if (!card) return state;
					const foundations = state.foundations.map((f, i) =>
						i === move.foundation ? [...f, card] : f
					);
					return withTableau({ ...state, foundations }, { [move.col]: col.slice(0, -1) });
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
					const card = topCard(f);
					if (!card) return state;
					const foundations = state.foundations.map((fp, i) =>
						i === move.foundation ? fp.slice(0, -1) : fp
					);
					return withTableau(
						{ ...state, foundations },
						{
							[move.col]: [...state.tableau[move.col], card]
						}
					);
				}
			}
		},

		isWon(state) {
			return state.foundations.reduce((n, f) => n + f.length, 0) === 52;
		},

		autoMove(state, card) {
			// double-tap a waste or tableau top card → send it to a foundation
			const wTop = topCard(state.waste);
			if (wTop && wTop.id === card.id) {
				const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(wTop, f));
				return fi >= 0 ? { type: 'wasteToFoundation', foundation: fi } : null;
			}
			for (let ci = 0; ci < state.tableau.length; ci++) {
				const t = topCard(state.tableau[ci]);
				if (t && t.id === card.id && t.faceUp) {
					const fi = state.foundations.findIndex((f) => canPlaceOnFoundation(t, f));
					return fi >= 0 ? { type: 'tableauToFoundation', col: ci, foundation: fi } : null;
				}
			}
			return null;
		},

		hint(state) {
			// prefer a productive move (something → foundation), else any tableau build
			const moves = this.legalMoves(state);
			return (
				moves.find((m) => m.type === 'tableauToFoundation' || m.type === 'wasteToFoundation') ??
				moves.find((m) => m.type === 'tableauToTableau' || m.type === 'wasteToTableau') ??
				null
			);
		}
	};

	const presenter: GamePresenter<KlondikeState, KlondikeMove> = {
		layout(): TableLayout {
			const slots = [
				{ pileId: STOCK, x: 0, y: 0 },
				{ pileId: WASTE, x: 1, y: 0 },
				{ pileId: foundationId(0), x: 3, y: 0 },
				{ pileId: foundationId(1), x: 4, y: 0 },
				{ pileId: foundationId(2), x: 5, y: 0 },
				{ pileId: foundationId(3), x: 6, y: 0 },
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.45 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
			out.push({ id: STOCK, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '↻' });
			// only the top few waste cards are individually visible (draw-3 fan)
			const visible = state.drawCount === 1 ? 1 : 3;
			out.push({
				id: WASTE,
				kind: 'waste',
				cards: state.waste.slice(Math.max(0, state.waste.length - visible)),
				fan: 'right'
			});
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
				if (tableauId(i) !== fromPileId && canPlaceOnTableau(run, col)) targets.push(tableauId(i));
			});
			if (run.length === 1) {
				state.foundations.forEach((f, i) => {
					if (foundationId(i) !== fromPileId && canPlaceOnFoundation(run[0], f))
						targets.push(foundationId(i));
				});
			}
			return targets;
		},

		resolveDrop(state, fromPileId, cardId, toPileId) {
			const run = grabRun(state, fromPileId, cardId);
			if (!run) return null;
			const toFoundation = toPileId.startsWith('foundation-');
			const toTableau = toPileId.startsWith('tableau-');

			if (fromPileId === WASTE) {
				if (toTableau && canPlaceOnTableau(run, state.tableau[parseIndex(toPileId)]))
					return { type: 'wasteToTableau', col: parseIndex(toPileId) };
				if (toFoundation && canPlaceOnFoundation(run[0], state.foundations[parseIndex(toPileId)]))
					return { type: 'wasteToFoundation', foundation: parseIndex(toPileId) };
				return null;
			}
			if (fromPileId.startsWith('foundation-')) {
				if (toTableau && canPlaceOnTableau(run, state.tableau[parseIndex(toPileId)]))
					return {
						type: 'foundationToTableau',
						foundation: parseIndex(fromPileId),
						col: parseIndex(toPileId)
					};
				return null;
			}
			if (fromPileId.startsWith('tableau-')) {
				const from = parseIndex(fromPileId);
				if (toTableau && canPlaceOnTableau(run, state.tableau[parseIndex(toPileId)]))
					return { type: 'tableauToTableau', from, to: parseIndex(toPileId), count: run.length };
				if (
					run.length === 1 &&
					toFoundation &&
					canPlaceOnFoundation(run[0], state.foundations[parseIndex(toPileId)])
				)
					return { type: 'tableauToFoundation', col: from, foundation: parseIndex(toPileId) };
				return null;
			}
			return null;
		},

		tap(state, pileId) {
			if (pileId !== STOCK) return null;
			if (state.stock.length > 0) return { type: 'draw' };
			if (state.waste.length > 0) return { type: 'recycle' };
			return null;
		}
	};

	return { definition, presenter };
}

export const klondike = makeKlondike(3);
export const klondikeDraw1 = makeKlondike(1);
