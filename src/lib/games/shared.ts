/**
 * Common helpers shared across game modules — pile-id formatting and the
 * recurring foundation/tableau rules. Keeping these in one place avoids the
 * subtle drift that comes from re-implementing them per game.
 */

import { setFaceUp, type Card } from '$lib/engine';

export const foundationId = (i: number) => `foundation-${i}`;
export const tableauId = (i: number) => `tableau-${i}`;
export const freeCellId = (i: number) => `free-${i}`;
export const parsePileIndex = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));

export function topCard(pile: readonly Card[]): Card | undefined {
	return pile[pile.length - 1];
}

/** Standard foundation rule: Ace starts it, then build up by the same suit. */
export function canStackOnFoundation(card: Card, foundation: readonly Card[]): boolean {
	const t = topCard(foundation);
	if (!t) return card.rank === 1;
	return t.suit === card.suit && card.rank === t.rank + 1;
}

/** `count` empty foundation piles. */
export function emptyFoundations(count: number): Card[][] {
	return Array.from({ length: count }, () => []);
}

/** Turn a tableau column's newly-exposed face-down top card face-up. */
export function flipExposedTop(col: readonly Card[]): readonly Card[] {
	const t = topCard(col);
	if (t && !t.faceUp) return [...col.slice(0, -1), setFaceUp(t, true)];
	return col;
}
