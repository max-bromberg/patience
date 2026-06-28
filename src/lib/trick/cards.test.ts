import { describe, expect, it } from 'vitest';
import { makeCard, type Rank, type Suit } from '$lib/engine';
import {
	cardStrength,
	effectiveSuit,
	euchreDeck,
	isLeftBower,
	isRightBower,
	legalPlays,
	sameColorSuit,
	trickWinnerIndex,
	type Play
} from './cards';

const c = (suit: Suit, rank: Rank) => makeCard(suit, rank, { faceUp: true });

describe('euchreDeck', () => {
	it('has 24 cards: 9,10,J,Q,K,A in four suits', () => {
		const d = euchreDeck();
		expect(d).toHaveLength(24);
		expect(
			d
				.filter((x) => x.suit === 'spades')
				.map((x) => x.rank)
				.sort((a, b) => a - b)
		).toEqual([1, 9, 10, 11, 12, 13]);
	});
});

describe('bowers', () => {
	it('right bower is the Jack of trump; left bower is the same-color Jack', () => {
		expect(isRightBower(c('spades', 11), 'spades')).toBe(true);
		expect(isLeftBower(c('clubs', 11), 'spades')).toBe(true); // clubs same color as spades
		expect(isLeftBower(c('hearts', 11), 'spades')).toBe(false);
	});
	it('left bower counts as the trump suit', () => {
		expect(effectiveSuit(c('clubs', 11), 'spades')).toBe('spades');
		expect(sameColorSuit('spades')).toBe('clubs');
	});
});

describe('cardStrength & trickWinner', () => {
	it('orders trump above plain suits, bowers highest', () => {
		const trump: Suit = 'spades';
		const right = cardStrength(c('spades', 11), trump, 'hearts');
		const left = cardStrength(c('clubs', 11), trump, 'hearts');
		const aceTrump = cardStrength(c('spades', 1), trump, 'hearts');
		const aceLed = cardStrength(c('hearts', 1), trump, 'hearts');
		expect(right).toBeGreaterThan(left);
		expect(left).toBeGreaterThan(aceTrump);
		expect(aceTrump).toBeGreaterThan(aceLed);
	});

	it('a non-following off-suit card cannot win', () => {
		const trump: Suit = 'spades';
		// led hearts; a diamond (off-suit, not trump) has zero strength
		expect(cardStrength(c('diamonds', 1), trump, 'hearts')).toBe(0);
	});

	it('resolves the winner of a trick with a left bower beating the Ace of trump', () => {
		const trump: Suit = 'spades';
		const plays: Play[] = [
			{ player: 0, card: c('hearts', 13) }, // K hearts (led)
			{ player: 1, card: c('spades', 1) }, // A trump
			{ player: 2, card: c('clubs', 11) }, // left bower (beats A trump)
			{ player: 3, card: c('hearts', 1) } // A hearts
		];
		expect(trickWinnerIndex(plays, trump)).toBe(2);
	});

	it('highest of the led suit wins when no trump is played', () => {
		const plays: Play[] = [
			{ player: 0, card: c('hearts', 12) },
			{ player: 1, card: c('hearts', 1) },
			{ player: 2, card: c('diamonds', 13) },
			{ player: 3, card: c('hearts', 9) }
		];
		expect(trickWinnerIndex(plays, 'spades')).toBe(1);
	});
});

describe('legalPlays', () => {
	it('must follow the led suit when able', () => {
		const hand = [c('hearts', 9), c('hearts', 13), c('spades', 1)];
		expect(legalPlays(hand, 'hearts', 'spades')).toHaveLength(2);
	});
	it('left bower follows trump, not its native suit', () => {
		const hand = [c('clubs', 11), c('diamonds', 9)];
		// trump spades; clubs J is effectively a spade. Led clubs → must we follow?
		// the club J is NOT a club here, so no club to follow → any card legal.
		expect(legalPlays(hand, 'clubs', 'spades')).toHaveLength(2);
	});
	it('anything is legal when leading', () => {
		const hand = [c('hearts', 9), c('spades', 1)];
		expect(legalPlays(hand, null, 'spades')).toHaveLength(2);
	});
});
