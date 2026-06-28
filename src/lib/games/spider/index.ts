/**
 * Spider — two decks (104 cards), 10 columns. Build DOWN regardless of suit to
 * place a card, but a group only MOVES if it is a same-suit descending run.
 * Assemble a full King-to-Ace same-suit run and it lifts off to a foundation;
 * clear all eight runs to win. Comes in 1/2/4-suit variants (easier → harder).
 */

import {
	isDescendingSameSuit,
	makeCard,
	mulberry32,
	shuffle,
	setFaceUp,
	type Card,
	type Game,
	type GameDefinition,
	type GamePresenter,
	type PileView,
	type Rank,
	type Suit,
	type TableLayout
} from '$lib/engine';

export interface SpiderState {
	readonly stock: readonly Card[]; // face-down; dealt 10 at a time
	readonly foundations: readonly (readonly Card[])[]; // up to 8 completed runs
	readonly tableau: readonly (readonly Card[])[]; // 10 columns
}

export type SpiderMove =
	{ type: 'deal' } | { type: 'move'; from: number; to: number; count: number };

const COLS = 10;
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

const stockId = 'stock';
const foundationId = (i: number) => `foundation-${i}`;
const tableauId = (i: number) => `tableau-${i}`;
const parseIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

function top(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

/** Build a 104-card Spider deck using `suitCount` distinct suits, then shuffle. */
function spiderDeck(seed: number, suitCount: 1 | 2 | 4): Card[] {
	const suits = ALL_SUITS.slice(0, suitCount);
	const cards: Card[] = [];
	for (let set = 0; set < 8; set++) {
		const suit = suits[set % suitCount];
		const copy = Math.floor(set / suitCount); // keeps ids unique per suit
		for (const rank of RANKS) cards.push(makeCard(suit, rank, { copy, faceUp: false }));
	}
	return shuffle(cards, mulberry32(seed));
}

/** Placement: any suit, one rank lower; empty column accepts anything. */
function canPlace(bottom: Card | undefined, col: readonly Card[]): boolean {
	if (!bottom) return false;
	const t = top(col);
	if (!t) return true;
	return t.rank === bottom.rank + 1;
}

/** Grab a same-suit descending run from `cardId` to the top of its column. */
function grabRun(state: SpiderState, pileId: string, cardId: string): readonly Card[] | null {
	if (!pileId.startsWith('tableau-')) return null;
	const col = state.tableau[parseIndex(pileId)];
	const idx = col.findIndex((c) => c.id === cardId);
	if (idx < 0 || !col[idx].faceUp) return null;
	const run = col.slice(idx);
	return isDescendingSameSuit(run) ? run : null;
}

function flipExposed(col: readonly Card[]): readonly Card[] {
	const t = top(col);
	if (t && !t.faceUp) return [...col.slice(0, -1), setFaceUp(t, true)];
	return col;
}

/**
 * Lift any completed King→Ace same-suit run off a column's top into a
 * foundation. Returns the settled tableau + foundations (loops in case a lift
 * exposes another completed run).
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
			const sameSuit = tail.every((c) => c.suit === tail[0].suit && c.faceUp);
			const isKtoA = tail.every((c, k) => c.rank === 13 - k);
			if (sameSuit && isKtoA) {
				found.push(tail);
				cols[i] = flipExposed(col.slice(0, col.length - 13)).slice();
				changed = true;
			}
		}
	}
	return { tableau: cols, foundations: found };
}

export function makeSpider(suitCount: 1 | 2 | 4): Game<SpiderState, SpiderMove> {
	const names: Record<number, string> = { 1: 'Spider (1 Suit)', 2: 'Spider (2 Suit)', 4: 'Spider' };
	const difficulty = suitCount === 1 ? 'easy' : suitCount === 2 ? 'medium' : 'hard';

	const definition: GameDefinition<SpiderState, SpiderMove> = {
		meta: {
			id: suitCount === 4 ? 'spider' : `spider-${suitCount}suit`,
			name: names[suitCount],
			blurb:
				suitCount === 1
					? 'Spider with a single suit — the friendliest way in.'
					: suitCount === 2
						? 'Spider with two suits — a balanced challenge.'
						: 'The full four-suit Spider. A proper test.',
			difficulty,
			family: 'spider',
			howTo: [
				'Clear all eight King-to-Ace runs to win.',
				'Build down by rank on the tableau — suit does not matter for placing a card.',
				'But you can only move a group if it is a same-suit run in sequence.',
				'Tap the stock to deal one card to every column (only when no column is empty).',
				'Complete a full King-to-Ace run in one suit and it is removed automatically.'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Spider_(solitaire)'
		},

		initialState(seed) {
			const deck = spiderDeck(seed, suitCount);
			const tableau: Card[][] = Array.from({ length: COLS }, () => []);
			let k = 0;
			for (let col = 0; col < COLS; col++) {
				const size = col < 4 ? 6 : 5; // 4×6 + 6×5 = 54
				for (let row = 0; row < size; row++) {
					tableau[col].push(setFaceUp(deck[k++], row === size - 1));
				}
			}
			const stock = deck.slice(k); // remaining 50, face-down
			return { stock, foundations: [], tableau };
		},

		legalMoves(state) {
			const moves: SpiderMove[] = [];
			if (state.stock.length > 0 && state.tableau.every((c) => c.length > 0))
				moves.push({ type: 'deal' });

			state.tableau.forEach((col, ci) => {
				for (let start = 0; start < col.length; start++) {
					if (!col[start].faceUp) continue;
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
			if (move.type === 'deal') {
				if (state.stock.length === 0 || state.tableau.some((c) => c.length === 0)) return state;
				const dealt = state.stock.slice(state.stock.length - COLS).map((c) => setFaceUp(c, true));
				const tableau = state.tableau.map((col, i) => [...col, dealt[i]]);
				const settled = collectRuns(tableau, state.foundations as Card[][]);
				return {
					stock: state.stock.slice(0, state.stock.length - COLS),
					foundations: settled.foundations,
					tableau: settled.tableau
				};
			}
			// move
			const from = state.tableau[move.from];
			const moved = from.slice(from.length - move.count);
			const tableau = state.tableau.map((col, i) => {
				if (i === move.from) return flipExposed(col.slice(0, col.length - move.count)).slice();
				if (i === move.to) return [...col, ...moved];
				return col.slice();
			});
			const settled = collectRuns(tableau, state.foundations as Card[][]);
			return { ...state, foundations: settled.foundations, tableau: settled.tableau };
		},

		isWon(state) {
			return state.foundations.length === 8;
		},

		hint(state) {
			return this.legalMoves(state).find((m) => m.type === 'move') ?? null;
		}
	};

	const presenter: GamePresenter<SpiderState, SpiderMove> = {
		layout(): TableLayout {
			const slots = [
				{ pileId: stockId, x: 0, y: 0 },
				...Array.from({ length: 8 }, (_, i) => ({ pileId: foundationId(i), x: i + 2, y: 0 })),
				...Array.from({ length: COLS }, (_, i) => ({ pileId: tableauId(i), x: i, y: 1.3 }))
			];
			return { columns: COLS, rows: 5, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = [];
			out.push({ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '' });
			for (let i = 0; i < 8; i++) {
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
		},

		tap(state, pileId) {
			if (pileId !== stockId) return null;
			if (state.stock.length > 0 && state.tableau.every((c) => c.length > 0))
				return { type: 'deal' };
			return null;
		}
	};

	return { definition, presenter };
}

export const spider1 = makeSpider(1);
export const spider2 = makeSpider(2);
export const spider4 = makeSpider(4);
