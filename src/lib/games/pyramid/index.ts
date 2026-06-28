/**
 * Pyramid — a pairing game (not a builder). Remove pairs of exposed cards whose
 * ranks add to 13; Kings (13) are removed on their own. A card is exposed once
 * the two cards overlapping it below are gone. Tap a card to select it, tap a
 * second to pair; tap the stock to turn a card to the waste (up to three passes).
 * Clear the whole pyramid to win.
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
import { topCard } from '../shared';

export interface PyramidState {
	readonly pyramid: readonly (Card | null)[]; // 28 slots
	readonly stock: readonly Card[];
	readonly waste: readonly Card[];
	readonly selected: string | null;
	readonly redealsLeft: number;
}

export type PyramidMove =
	| { type: 'flip' }
	| { type: 'recycle' }
	| { type: 'select'; cardId: string | null }
	| { type: 'removeKing'; cardId: string }
	| { type: 'pair'; a: string; b: string };

const ROW_STEP = 0.42;
const REDEALS = 2;
const stockId = 'stock';
const wasteId = 'waste';
const pyrId = (i: number) => `pyr-${i}`;

// Pyramid geometry: rows of 1..7 cards (28 total).
const POSITIONS: { x: number; y: number }[] = [];
const COVERERS: number[][] = [];
for (let r = 0; r < 7; r++) {
	for (let j = 0; j <= r; j++) {
		POSITIONS.push({ x: (6 - r) / 2 + j, y: r * ROW_STEP });
		if (r < 6) {
			const nextBase = ((r + 1) * (r + 2)) / 2;
			COVERERS.push([nextBase + j, nextBase + j + 1]);
		} else {
			COVERERS.push([]);
		}
	}
}

function isExposed(pyramid: readonly (Card | null)[], idx: number): boolean {
	return COVERERS[idx].every((i) => pyramid[i] === null);
}

type Loc = { where: 'pyramid'; idx: number } | { where: 'waste' };

/** Where a currently-playable card lives, or null if it isn't playable. */
function locate(state: PyramidState, cardId: string): Loc | null {
	const wt = topCard(state.waste);
	if (wt && wt.id === cardId) return { where: 'waste' };
	const idx = state.pyramid.findIndex((c) => c?.id === cardId);
	if (idx >= 0 && isExposed(state.pyramid, idx)) return { where: 'pyramid', idx };
	return null;
}

function cardOf(state: PyramidState, cardId: string): Card | null {
	const loc = locate(state, cardId);
	if (!loc) return null;
	return loc.where === 'waste' ? (topCard(state.waste) ?? null) : (state.pyramid[loc.idx] ?? null);
}

function removeCard(state: PyramidState, cardId: string): Partial<PyramidState> {
	const loc = locate(state, cardId);
	if (!loc) return {};
	if (loc.where === 'waste') return { waste: state.waste.slice(0, -1) };
	return { pyramid: state.pyramid.map((c, i) => (i === loc.idx ? null : c)) };
}

export function makePyramid(): Game<PyramidState, PyramidMove> {
	const definition: GameDefinition<PyramidState, PyramidMove> = {
		meta: {
			id: 'pyramid',
			name: 'Pyramid',
			blurb: 'Pair cards that add to 13 to clear the pyramid.',
			difficulty: 'medium',
			family: 'pairer',
			howTo: [
				'Clear all 28 cards from the pyramid to win.',
				'Tap two exposed cards whose ranks add to 13 to remove them (A=1 … Q=12).',
				'Kings are worth 13 — tap one to remove it on its own.',
				'A card is playable once the two cards overlapping it below are gone.',
				'Tap the stock to turn a card to the waste; the waste card can pair too (up to three passes).'
			],
			learnMore: 'https://en.wikipedia.org/wiki/Pyramid_(solitaire)'
		},

		initialState(seed) {
			const deck = shuffledDeck(seed);
			const pyramid = deck.slice(0, 28).map((c) => setFaceUp(c, true));
			const stock = deck.slice(28).map((c) => setFaceUp(c, false));
			return { pyramid, stock, waste: [], selected: null, redealsLeft: REDEALS };
		},

		legalMoves(state) {
			const moves: PyramidMove[] = [];
			if (state.stock.length > 0) moves.push({ type: 'flip' });
			else if (state.waste.length > 0 && state.redealsLeft > 0) moves.push({ type: 'recycle' });

			const playable: Card[] = [];
			const wt = topCard(state.waste);
			if (wt) playable.push(wt);
			state.pyramid.forEach((c, i) => {
				if (c && isExposed(state.pyramid, i)) playable.push(c);
			});

			for (const c of playable) if (c.rank === 13) moves.push({ type: 'removeKing', cardId: c.id });
			for (let i = 0; i < playable.length; i++) {
				for (let j = i + 1; j < playable.length; j++) {
					if (playable[i].rank + playable[j].rank === 13)
						moves.push({ type: 'pair', a: playable[i].id, b: playable[j].id });
				}
			}
			return moves;
		},

		applyMove(state, move) {
			switch (move.type) {
				case 'flip': {
					const card = topCard(state.stock);
					if (!card) return state;
					return {
						...state,
						stock: state.stock.slice(0, -1),
						waste: [...state.waste, setFaceUp(card, true)],
						selected: null
					};
				}
				case 'recycle': {
					if (state.stock.length > 0 || state.waste.length === 0 || state.redealsLeft <= 0)
						return state;
					return {
						...state,
						stock: state.waste
							.slice()
							.reverse()
							.map((c) => setFaceUp(c, false)),
						waste: [],
						redealsLeft: state.redealsLeft - 1,
						selected: null
					};
				}
				case 'select':
					return { ...state, selected: move.cardId };
				case 'removeKing':
					return { ...state, ...removeCard(state, move.cardId), selected: null };
				case 'pair': {
					const afterA = { ...state, ...removeCard(state, move.a) };
					return { ...afterA, ...removeCard(afterA, move.b), selected: null };
				}
			}
		},

		isWon(state) {
			return state.pyramid.every((c) => c === null);
		},

		hint(state) {
			return (
				this.legalMoves(state).find((m) => m.type === 'pair' || m.type === 'removeKing') ?? null
			);
		}
	};

	const presenter: GamePresenter<PyramidState, PyramidMove> = {
		layout(): TableLayout {
			const slots = [
				...POSITIONS.map((p, i) => ({ pileId: pyrId(i), x: p.x, y: p.y })),
				{ pileId: stockId, x: 2, y: 3.5 },
				{ pileId: wasteId, x: 4, y: 3.5 }
			];
			return { columns: 7, rows: 6, slots };
		},

		piles(state): PileView[] {
			const out: PileView[] = state.pyramid.map((card, i) => ({
				id: pyrId(i),
				kind: 'pyramid',
				cards: card ? [card] : [],
				fan: 'none' as const
			}));
			out.push({ id: stockId, kind: 'stock', cards: state.stock, fan: 'none', placeholder: '↻' });
			out.push({ id: wasteId, kind: 'waste', cards: state.waste, fan: 'none' });
			return out;
		},

		grab: () => null,
		dropTargets: () => [],
		resolveDrop: () => null,

		highlight: (state) => (state.selected ? [state.selected] : []),

		tap(state, pileId, cardId) {
			if (pileId === stockId) {
				if (state.stock.length > 0) return { type: 'flip' };
				if (state.waste.length > 0 && state.redealsLeft > 0) return { type: 'recycle' };
				return null;
			}
			if (cardId === null) return null;
			const card = cardOf(state, cardId);
			if (!card) return null; // covered / not playable
			if (card.rank === 13) return { type: 'removeKing', cardId };

			if (state.selected === null) return { type: 'select', cardId };
			if (state.selected === cardId) return { type: 'select', cardId: null };

			const sel = cardOf(state, state.selected);
			if (sel && sel.rank + card.rank === 13) return { type: 'pair', a: state.selected, b: cardId };
			return { type: 'select', cardId };
		}
	};

	return { definition, presenter };
}

export const pyramid = makePyramid();
