import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { freecell, type FreeCellState } from '$lib/games/freecell';
import { autoFinishWins } from './autofinish';

const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });
const upTo = (s: Suit, n: number) => Array.from({ length: n }, (_, i) => c(s, (i + 1) as Rank));
const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

describe('autoFinishWins', () => {
	const { definition, presenter } = freecell;

	it('is true when sending every top card to a foundation wins', () => {
		// foundations at Queen for all suits; the four Kings sit atop columns
		const state: FreeCellState = {
			freeCells: [null, null, null, null],
			foundations: suits.map((s) => upTo(s, 12)),
			tableau: [
				[c('spades', 13)],
				[c('hearts', 13)],
				[c('diamonds', 13)],
				[c('clubs', 13)],
				[],
				[],
				[],
				[]
			]
		};
		expect(autoFinishWins(definition, presenter, state)).toBe(true);
	});

	it('is false when a needed card is buried under another', () => {
		const state: FreeCellState = {
			freeCells: [null, null, null, null],
			foundations: suits.map((s) => upTo(s, 12)),
			// K♠ is buried beneath 5♥, so the cascade stalls before winning
			tableau: [
				[c('spades', 13), c('hearts', 5)],
				[c('hearts', 13)],
				[c('diamonds', 13)],
				[c('clubs', 13)],
				[],
				[],
				[],
				[]
			]
		};
		expect(autoFinishWins(definition, presenter, state)).toBe(false);
	});

	it('is false for a fresh deal (not trivially solved)', () => {
		expect(autoFinishWins(definition, presenter, definition.initialState(1))).toBe(false);
	});
});
