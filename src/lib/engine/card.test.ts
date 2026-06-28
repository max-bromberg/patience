import { describe, expect, it } from 'vitest';
import {
	cardColor,
	cardId,
	compareCards,
	flip,
	isOppositeColor,
	isRankAbove,
	makeCard,
	setFaceUp,
	suitColor
} from './card';

describe('color', () => {
	it('maps suits to colors', () => {
		expect(suitColor('hearts')).toBe('red');
		expect(suitColor('diamonds')).toBe('red');
		expect(suitColor('spades')).toBe('black');
		expect(suitColor('clubs')).toBe('black');
	});

	it('detects opposite colors', () => {
		expect(isOppositeColor(makeCard('hearts', 5), makeCard('spades', 6))).toBe(true);
		expect(isOppositeColor(makeCard('hearts', 5), makeCard('diamonds', 6))).toBe(false);
	});
});

describe('cardId / makeCard', () => {
	it('builds stable ids including a copy index', () => {
		expect(cardId('spades', 13)).toBe('spades-13-0');
		expect(cardId('spades', 13, 1)).toBe('spades-13-1');
		expect(makeCard('hearts', 1).id).toBe('hearts-1-0');
	});

	it('defaults to face-down', () => {
		expect(makeCard('clubs', 7).faceUp).toBe(false);
		expect(makeCard('clubs', 7, { faceUp: true }).faceUp).toBe(true);
	});

	it('exposes color via cardColor', () => {
		expect(cardColor(makeCard('hearts', 2))).toBe('red');
	});
});

describe('immutable flips', () => {
	it('flip returns a new card with same identity', () => {
		const c = makeCard('spades', 10, { faceUp: false });
		const f = flip(c);
		expect(f).not.toBe(c);
		expect(f.id).toBe(c.id);
		expect(f.faceUp).toBe(true);
		expect(c.faceUp).toBe(false); // original untouched
	});

	it('setFaceUp is a no-op (same reference) when unchanged', () => {
		const c = makeCard('spades', 10, { faceUp: true });
		expect(setFaceUp(c, true)).toBe(c);
	});
});

describe('rank helpers', () => {
	it('isRankAbove checks exact +1 with no wrap', () => {
		expect(isRankAbove(8, 7)).toBe(true);
		expect(isRankAbove(7, 8)).toBe(false);
		expect(isRankAbove(1, 13)).toBe(false);
	});

	it('compareCards orders by rank then suit', () => {
		expect(compareCards(makeCard('spades', 2), makeCard('hearts', 5))).toBeLessThan(0);
		expect(compareCards(makeCard('hearts', 5), makeCard('spades', 5))).toBeGreaterThan(0);
	});
});
