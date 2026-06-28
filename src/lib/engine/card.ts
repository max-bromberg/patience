/**
 * Card construction, ordering, and color. Pure logic only — display concerns
 * (suit glyphs, rank labels for rendering) live in the render/theme layer.
 */

import type { Card, Color, Rank, Suit } from './types';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['hearts', 'diamonds']);

export function suitColor(suit: Suit): Color {
	return RED_SUITS.has(suit) ? 'red' : 'black';
}

export function cardColor(card: Card): Color {
	return suitColor(card.suit);
}

/** True if the two cards are opposite colors (used by alternating-color builds). */
export function isOppositeColor(a: Card, b: Card): boolean {
	return cardColor(a) !== cardColor(b);
}

/**
 * Deterministic, unique-within-a-deal id. `copy` distinguishes duplicate cards
 * in multi-deck games (e.g. Spider uses two decks); it defaults to 0.
 */
export function cardId(suit: Suit, rank: Rank, copy = 0): string {
	return `${suit}-${rank}-${copy}`;
}

export function makeCard(
	suit: Suit,
	rank: Rank,
	options: { faceUp?: boolean; copy?: number } = {}
): Card {
	const { faceUp = false, copy = 0 } = options;
	return { id: cardId(suit, rank, copy), suit, rank, faceUp };
}

/** Return a new card with the given face-up state, preserving identity. */
export function setFaceUp(card: Card, faceUp: boolean): Card {
	return card.faceUp === faceUp ? card : { ...card, faceUp };
}

export function flip(card: Card): Card {
	return setFaceUp(card, !card.faceUp);
}

/** True if `higher` is exactly one rank above `lower` (no wrap). */
export function isRankAbove(higher: Rank, lower: Rank): boolean {
	return higher - lower === 1;
}

/** Compare by rank then suit order — handy for stable sorting / assertions. */
export function compareCards(a: Card, b: Card): number {
	if (a.rank !== b.rank) return a.rank - b.rank;
	return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
}
