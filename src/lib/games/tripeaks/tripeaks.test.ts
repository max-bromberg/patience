import { describe, expect, it } from 'vitest';
import { makeCard, type Card, type Rank, type Suit } from '$lib/engine';
import { tripeaks, type TriPeaksState } from './index';

const def = tripeaks.definition;
const pres = tripeaks.presenter;
const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank, { faceUp: true });

describe('deal', () => {
	const s = def.initialState(9);
	it('lays out 28 peak cards, 1 in the waste, 23 in the stock', () => {
		expect(s.peaks.filter(Boolean)).toHaveLength(28);
		expect(s.waste).toHaveLength(1);
		expect(s.stock).toHaveLength(23);
	});
});

describe('coverage & playing', () => {
	// Build a state where one base card is exposed and others are not.
	function freshPeaks(): (Card | null)[] {
		// distinct cards per slot so ids are unique
		return Array.from({ length: 28 }, (_, i) => c('spades', ((i % 13) + 1) as Rank));
	}

	it('base-row cards are exposed; covered cards are not playable', () => {
		const peaks = freshPeaks();
		// place a known card at base slot 18 and on the waste a neighbor rank
		peaks[18] = c('hearts', 5);
		const state: TriPeaksState = { peaks, stock: [], waste: [c('clubs', 6)] };
		// slot 18 (base) is exposed; 5 is adjacent to 6 → playable
		expect(pres.tap!(state, 'peak-18', peaks[18]!.id)).toEqual({ type: 'play', index: 18 });
		// a tip (slot 0) is covered by slots 3 & 4 (still present) → not playable
		expect(pres.tap!(state, 'peak-0', peaks[0]!.id)).toBeNull();
	});

	it('wraps: an Ace plays on a King', () => {
		const peaks = freshPeaks();
		peaks[27] = c('hearts', 1); // base slot, exposed
		const state: TriPeaksState = { peaks, stock: [], waste: [c('spades', 13)] };
		expect(pres.tap!(state, 'peak-27', peaks[27]!.id)).toEqual({ type: 'play', index: 27 });
	});

	it('exposes a covered card after both coverers are cleared', () => {
		const peaks = freshPeaks();
		// tip 0 is covered by 3 and 4; clear them, then 0 is exposed
		peaks[3] = null;
		peaks[4] = null;
		peaks[0] = c('hearts', 5);
		const state: TriPeaksState = { peaks, stock: [], waste: [c('clubs', 4)] };
		expect(pres.tap!(state, 'peak-0', peaks[0]!.id)).toEqual({ type: 'play', index: 0 });
	});

	it('wins when all peaks are cleared', () => {
		expect(
			def.isWon({
				peaks: Array.from({ length: 28 }, () => null),
				stock: [],
				waste: [c('hearts', 5)]
			})
		).toBe(true);
	});
});
