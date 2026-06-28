import { describe, expect, it } from 'vitest';
import { makeCard } from './card';
import {
	add,
	bottom,
	isDescendingAltColor,
	isDescendingSameSuit,
	isEmpty,
	moveTop,
	takeTop,
	top,
	topRun
} from './pile';

const c = (suit: Parameters<typeof makeCard>[0], rank: Parameters<typeof makeCard>[1]) =>
	makeCard(suit, rank, { faceUp: true });

describe('basic accessors', () => {
	const pile = [c('spades', 2), c('hearts', 5), c('clubs', 9)];
	it('top/bottom/isEmpty', () => {
		expect(top(pile)?.rank).toBe(9);
		expect(bottom(pile)?.rank).toBe(2);
		expect(isEmpty(pile)).toBe(false);
		expect(isEmpty([])).toBe(true);
		expect(top([])).toBeUndefined();
	});
});

describe('immutable moves', () => {
	it('add appends on top without mutating', () => {
		const pile = [c('spades', 2)];
		const next = add(pile, c('hearts', 3));
		expect(next).toHaveLength(2);
		expect(pile).toHaveLength(1);
		expect(top(next)?.rank).toBe(3);
	});

	it('takeTop splits correctly and validates range', () => {
		const pile = [c('spades', 2), c('hearts', 3), c('clubs', 4)];
		const { taken, rest } = takeTop(pile, 2);
		expect(taken.map((x) => x.rank)).toEqual([3, 4]);
		expect(rest.map((x) => x.rank)).toEqual([2]);
		expect(() => takeTop(pile, 5)).toThrow(RangeError);
	});

	it('topRun reads the top n without mutation', () => {
		const pile = [c('spades', 2), c('hearts', 3), c('clubs', 4)];
		expect(topRun(pile, 2).map((x) => x.rank)).toEqual([3, 4]);
		expect(pile).toHaveLength(3);
	});

	it('moveTop transfers cards preserving order', () => {
		const from = [c('spades', 2), c('hearts', 3), c('clubs', 4)];
		const to = [c('diamonds', 10)];
		const result = moveTop(from, to, 2);
		expect(result.from.map((x) => x.rank)).toEqual([2]);
		expect(result.to.map((x) => x.rank)).toEqual([10, 3, 4]);
	});
});

describe('run validation', () => {
	it('isDescendingAltColor accepts a valid alternating run', () => {
		// 7♠ (black) 6♥ (red) 5♣ (black)
		expect(isDescendingAltColor([c('spades', 7), c('hearts', 6), c('clubs', 5)])).toBe(true);
	});

	it('isDescendingAltColor rejects same-color or wrong order', () => {
		expect(isDescendingAltColor([c('spades', 7), c('clubs', 6)])).toBe(false); // same color
		expect(isDescendingAltColor([c('spades', 6), c('hearts', 7)])).toBe(false); // ascending
	});

	it('single card and empty are trivially valid', () => {
		expect(isDescendingAltColor([c('spades', 7)])).toBe(true);
		expect(isDescendingAltColor([])).toBe(true);
	});

	it('isDescendingSameSuit checks suit + descending rank', () => {
		expect(isDescendingSameSuit([c('hearts', 9), c('hearts', 8), c('hearts', 7)])).toBe(true);
		expect(isDescendingSameSuit([c('hearts', 9), c('spades', 8)])).toBe(false);
	});
});
