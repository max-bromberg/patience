import { describe, expect, it } from 'vitest';
import { makeCard, type Rank, type Suit } from '$lib/engine';
import {
	cardStrength,
	deck52,
	legalFollow,
	rankValue,
	trickWinnerIndex,
	type Play
} from './standard';

const c = (suit: Suit, rank: Rank) => makeCard(suit, rank, { faceUp: true });

describe('deck52', () => {
	it('has 52 unique cards', () => {
		const d = deck52();
		expect(d).toHaveLength(52);
		expect(new Set(d.map((x) => `${x.suit}${x.rank}`)).size).toBe(52);
	});
});

describe('rankValue', () => {
	it('makes the Ace high', () => {
		expect(rankValue(1)).toBe(14);
		expect(rankValue(13)).toBe(13);
		expect(rankValue(2)).toBe(2);
	});
});

describe('trickWinnerIndex', () => {
	it('highest of the led suit wins with no trump', () => {
		const plays: Play[] = [
			{ player: 0, card: c('hearts', 12) },
			{ player: 1, card: c('hearts', 1) }, // ace
			{ player: 2, card: c('spades', 13) }, // off-suit
			{ player: 3, card: c('hearts', 9) }
		];
		expect(trickWinnerIndex(plays, null)).toBe(1);
	});

	it('any trump beats the led suit', () => {
		const plays: Play[] = [
			{ player: 0, card: c('hearts', 1) }, // ace led
			{ player: 1, card: c('spades', 2) }, // low trump
			{ player: 2, card: c('hearts', 13) }
		];
		expect(trickWinnerIndex(plays, 'spades')).toBe(1);
	});

	it('off-suit non-trump can never win', () => {
		expect(cardStrength(c('diamonds', 1), 'spades', 'hearts')).toBeLessThan(
			cardStrength(c('hearts', 2), 'spades', 'hearts')
		);
	});
});

describe('legalFollow', () => {
	it('must follow the led suit when able', () => {
		const hand = [c('hearts', 9), c('hearts', 2), c('spades', 1)];
		expect(legalFollow(hand, 'hearts', 'spades')).toHaveLength(2);
	});
	it('anything goes when void in the led suit', () => {
		const hand = [c('clubs', 9), c('spades', 1)];
		expect(legalFollow(hand, 'hearts', 'spades')).toHaveLength(2);
	});
	it('anything goes when leading', () => {
		const hand = [c('clubs', 9), c('spades', 1)];
		expect(legalFollow(hand, null, 'spades')).toHaveLength(2);
	});
});
