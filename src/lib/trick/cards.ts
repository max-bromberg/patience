/**
 * Euchre-family card primitives: the 24-card deck and the trump-aware ranking
 * (right/left bowers) used to resolve tricks. Pure; reuses the engine's Card.
 */

import { makeCard, suitColor, SUITS, type Card, type Rank, type Suit } from '$lib/engine';

/** Euchre uses 9, 10, J, Q, K, A in each suit (A is high). */
export const EUCHRE_RANKS: readonly Rank[] = [9, 10, 11, 12, 13, 1];

/** Build the 24-card Euchre deck (face-up). */
export function euchreDeck(): Card[] {
	const cards: Card[] = [];
	for (const suit of SUITS)
		for (const rank of EUCHRE_RANKS) cards.push(makeCard(suit, rank, { faceUp: true }));
	return cards;
}

export function sameColor(a: Suit, b: Suit): boolean {
	return suitColor(a) === suitColor(b);
}

/** The other suit of the same color (the left bower's native suit for a trump). */
export function sameColorSuit(suit: Suit): Suit {
	return SUITS.find((s) => s !== suit && sameColor(s, suit))!;
}

export function isRightBower(card: Card, trump: Suit): boolean {
	return card.rank === 11 && card.suit === trump;
}

export function isLeftBower(card: Card, trump: Suit): boolean {
	return card.rank === 11 && card.suit !== trump && sameColor(card.suit, trump);
}

/** A card's effective suit, accounting for the left bower belonging to trump. */
export function effectiveSuit(card: Card, trump: Suit | null): Suit {
	if (trump && isLeftBower(card, trump)) return trump;
	return card.suit;
}

/** Rank order within a plain (non-trump) suit, Ace high: A=6 … 9=1. */
function plainOrder(rank: Rank): number {
	if (rank === 1) return 6; // Ace
	if (rank === 13) return 5;
	if (rank === 12) return 4;
	if (rank === 11) return 3;
	if (rank === 10) return 2;
	return 1; // 9
}

/**
 * A comparable strength for `card` given the trump and the suit that was led.
 * Trump beats everything; within trump the bowers rank highest. Off-suit cards
 * that aren't following the led suit can't win (strength 0).
 */
export function cardStrength(card: Card, trump: Suit, ledSuit: Suit): number {
	if (isRightBower(card, trump)) return 100;
	if (isLeftBower(card, trump)) return 99;
	if (effectiveSuit(card, trump) === trump) return 90 + plainOrder(card.rank);
	if (card.suit === ledSuit) return 10 + plainOrder(card.rank);
	return 0;
}

export interface Play {
	readonly player: number;
	readonly card: Card;
}

/** The index into `plays` of the winning play. `plays` must be non-empty. */
export function trickWinnerIndex(plays: readonly Play[], trump: Suit): number {
	const ledSuit = effectiveSuit(plays[0].card, trump);
	let best = 0;
	let bestStrength = cardStrength(plays[0].card, trump, ledSuit);
	for (let i = 1; i < plays.length; i++) {
		const s = cardStrength(plays[i].card, trump, ledSuit);
		if (s > bestStrength) {
			bestStrength = s;
			best = i;
		}
	}
	return best;
}

/** Which of a hand's cards are legal to play given the led suit (must follow). */
export function legalPlays(hand: readonly Card[], ledSuit: Suit | null, trump: Suit): Card[] {
	if (ledSuit === null) return [...hand];
	const following = hand.filter((c) => effectiveSuit(c, trump) === ledSuit);
	return following.length > 0 ? following : [...hand];
}
