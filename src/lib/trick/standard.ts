/**
 * Standard 52-card trick-taking primitives shared by Hearts, Spades, Oh Hell,
 * etc. Pure; reuses the engine's Card. (Euchre uses its own 24-card module with
 * bower ranking — these are kept separate on purpose.)
 */

import { makeCard, SUITS, type Card, type Rank, type Suit } from '$lib/engine';

/** 2,3,…,10,J,Q,K,A. Ace is high in every game here. */
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1];

/** Build a full 52-card deck (face-up). */
export function deck52(): Card[] {
	const cards: Card[] = [];
	for (const suit of SUITS)
		for (const rank of RANKS) cards.push(makeCard(suit, rank, { faceUp: true }));
	return cards;
}

/** Comparable rank, Ace high: 2→2 … K→13, A→14. */
export function rankValue(rank: Rank): number {
	return rank === 1 ? 14 : rank;
}

export interface Play {
	readonly player: number;
	readonly card: Card;
}

/** Strength of a card given the trump (or null) and the led suit. */
export function cardStrength(card: Card, trump: Suit | null, led: Suit): number {
	if (trump && card.suit === trump) return 200 + rankValue(card.rank);
	if (card.suit === led) return 100 + rankValue(card.rank);
	return rankValue(card.rank); // off-suit, not trump: cannot win the trick
}

/** Index into `plays` of the winning play. `plays` must be non-empty. */
export function trickWinnerIndex(plays: readonly Play[], trump: Suit | null): number {
	const led = plays[0].card.suit;
	let best = 0;
	let bestVal = cardStrength(plays[0].card, trump, led);
	for (let i = 1; i < plays.length; i++) {
		const v = cardStrength(plays[i].card, trump, led);
		if (v > bestVal) {
			bestVal = v;
			best = i;
		}
	}
	return best;
}

/** Cards that legally follow the led suit (must follow if able). */
export function legalFollow(hand: readonly Card[], led: Suit | null, _trump: Suit | null): Card[] {
	void _trump;
	if (led === null) return [...hand];
	const follow = hand.filter((c) => c.suit === led);
	return follow.length > 0 ? follow : [...hand];
}

/** Sort a hand for display: by suit then rank (Ace high). */
export function sortHand(hand: readonly Card[]): Card[] {
	const order: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
	return [...hand].sort(
		(a, b) => order[a.suit] - order[b.suit] || rankValue(b.rank) - rankValue(a.rank)
	);
}
