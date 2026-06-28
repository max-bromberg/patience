import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { fortythieves, type FortyThievesState } from './index';

const def = fortythieves.definition;
const pres = fortythieves.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

const empty = (tableau: Card[][]): FortyThievesState => ({
	stock: [],
	waste: [],
	foundations: Array.from({ length: 8 }, () => []),
	tableau: [...tableau, ...Array.from({ length: 10 - tableau.length }, () => [])]
});

describe('deal', () => {
	const s = def.initialState(3);
	it('deals 10 columns of 4 from two decks; 64 to the stock', () => {
		expect(s.tableau.map((col) => col.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
		expect(s.stock).toHaveLength(64);
		expect([...s.tableau.flat(), ...s.stock]).toHaveLength(104);
	});
});

describe('rules', () => {
	it('builds down within the same suit only', () => {
		const state = empty([[c('spades', 7)], [c('spades', 8)], [c('hearts', 8)]]);
		// 7♠ onto 8♠ ok; onto 8♥ not
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).toContain('tableau-1');
		expect(pres.dropTargets(state, 'tableau-0', c('spades', 7).id)).not.toContain('tableau-2');
	});

	it('any card may go to an empty column', () => {
		const state = empty([[c('hearts', 5)]]);
		expect(pres.dropTargets(state, 'tableau-0', c('hearts', 5).id)).toContain('tableau-1');
	});

	it('sends an Ace then builds the foundation up by suit', () => {
		const state: FortyThievesState = { ...empty([]), waste: [c('clubs', 1)] };
		expect(pres.dropTargets(state, 'waste', c('clubs', 1).id)).toContain('foundation-0');
	});

	it('draws from stock to waste (no redeal)', () => {
		const state: FortyThievesState = { ...empty([]), stock: [c('diamonds', 9)] };
		const next = def.applyMove(state, { type: 'draw' });
		expect(next.waste).toHaveLength(1);
		expect(next.stock).toHaveLength(0);
	});
});
