/**
 * Pile operations and run/sequence validation. A `Pile` is an ordered list of
 * cards where index 0 is the BOTTOM and the last element is the TOP. All
 * mutating-looking helpers are pure: they return new piles and never touch
 * their inputs (immutability is what gives undo + snapshots for free).
 */

import { isOppositeColor, isRankAbove } from './card';
import type { Card } from './types';

export type Pile = readonly Card[];

export function isEmpty(pile: Pile): boolean {
	return pile.length === 0;
}

/** The top (last) card, or undefined if the pile is empty. */
export function top(pile: Pile): Card | undefined {
	return pile[pile.length - 1];
}

/** The bottom (first) card, or undefined if the pile is empty. */
export function bottom(pile: Pile): Card | undefined {
	return pile[0];
}

/** A new pile with `cards` added on top. */
export function add(pile: Pile, cards: Card | readonly Card[]): Card[] {
	return pile.concat(cards);
}

/**
 * Split off the top `count` cards. Returns the cards taken (in bottom-to-top
 * order) and the remaining pile. Throws if `count` exceeds the pile size.
 */
export function takeTop(pile: Pile, count: number): { taken: Card[]; rest: Card[] } {
	if (count < 0 || count > pile.length) {
		throw new RangeError(`takeTop: count ${count} out of range for pile of ${pile.length}`);
	}
	const cut = pile.length - count;
	return { taken: pile.slice(cut), rest: pile.slice(0, cut) };
}

/** The top `count` cards (bottom-to-top), without modifying the pile. */
export function topRun(pile: Pile, count: number): Card[] {
	return pile.slice(Math.max(0, pile.length - count));
}

/**
 * Move the top `count` cards from `from` onto `to`, preserving order. Pure:
 * returns new versions of both piles.
 */
export function moveTop(from: Pile, to: Pile, count: number): { from: Card[]; to: Card[] } {
	const { taken, rest } = takeTop(from, count);
	return { from: rest, to: add(to, taken) };
}

/**
 * Validate that consecutive cards in `cards` (bottom→top) satisfy `ok`. An
 * empty run or single card is trivially valid. Games compose this with a
 * predicate describing their build rule.
 */
export function isRun(cards: readonly Card[], ok: (lower: Card, upper: Card) => boolean): boolean {
	for (let i = 1; i < cards.length; i++) {
		if (!ok(cards[i - 1], cards[i])) return false;
	}
	return true;
}

/** Descending rank, alternating color (Klondike tableau run). */
export function isDescendingAltColor(cards: readonly Card[]): boolean {
	return isRun(
		cards,
		(lower, upper) => isRankAbove(lower.rank, upper.rank) && isOppositeColor(lower, upper)
	);
}

/** Descending rank, same suit (Spider/Yukon-style sequence). */
export function isDescendingSameSuit(cards: readonly Card[]): boolean {
	return isRun(
		cards,
		(lower, upper) => isRankAbove(lower.rank, upper.rank) && lower.suit === upper.suit
	);
}
