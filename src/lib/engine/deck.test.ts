import { describe, expect, it } from 'vitest';
import { buildDeck, shuffle, shuffledDeck } from './deck';
import { mulberry32 } from './rng';
import { compareCards } from './card';

describe('buildDeck', () => {
	it('builds 52 unique cards for one deck', () => {
		const deck = buildDeck();
		expect(deck).toHaveLength(52);
		expect(new Set(deck.map((c) => c.id)).size).toBe(52);
	});

	it('builds 104 unique cards for two decks', () => {
		const deck = buildDeck({ decks: 2 });
		expect(deck).toHaveLength(104);
		expect(new Set(deck.map((c) => c.id)).size).toBe(104);
	});

	it('honors faceUp option', () => {
		expect(buildDeck({ faceUp: true }).every((c) => c.faceUp)).toBe(true);
		expect(buildDeck().every((c) => !c.faceUp)).toBe(true);
	});
});

describe('shuffle', () => {
	it('does not mutate the input', () => {
		const deck = buildDeck();
		const copy = deck.slice();
		shuffle(deck, mulberry32(1));
		expect(deck).toEqual(copy);
	});

	it('preserves the multiset of cards', () => {
		const deck = buildDeck();
		const shuffled = shuffle(deck, mulberry32(99));
		expect([...shuffled].sort(compareCards)).toEqual([...deck].sort(compareCards));
	});
});

describe('shuffledDeck determinism', () => {
	it('same seed → identical deal', () => {
		const a = shuffledDeck(2024).map((c) => c.id);
		const b = shuffledDeck(2024).map((c) => c.id);
		expect(a).toEqual(b);
	});

	it('different seed → different order (almost surely)', () => {
		const a = shuffledDeck(1).map((c) => c.id);
		const b = shuffledDeck(2).map((c) => c.id);
		expect(a).not.toEqual(b);
	});
});
