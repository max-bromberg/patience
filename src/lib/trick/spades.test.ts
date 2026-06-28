import { describe, expect, it } from 'vitest';
import { spades, type SpadesState } from './spades';

function drain(s: SpadesState): SpadesState {
	let n: SpadesState | null;
	let g = 0;
	while ((n = spades.stepAuto(s)) !== null && g++ < 100) s = n;
	return s;
}
function playOut(seed: number): SpadesState {
	let s = drain(spades.newGame(seed));
	let g = 0;
	while (s.phase !== 'gameOver' && g++ < 20000) {
		const m = spades.suggest(s);
		if (!m) break;
		s = drain(spades.apply(s, m));
	}
	return s;
}

describe('spades deal & bidding', () => {
	const s = spades.newGame(3);
	it('deals 13 each and the human bids first', () => {
		expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
		expect(s.phase).toBe('bidding');
		expect(s.turn).toBe(0);
	});
	it('reaches the play phase once everyone has bid', () => {
		let t = spades.apply(s, { type: 'bid', n: 3 });
		t = drain(t);
		expect(t.bids.every((b) => b !== null)).toBe(true);
		expect(t.phase).toBe('playing');
	});
});

describe('spades full games', () => {
	it('terminate with a partnership winner at/after 250', () => {
		for (const seed of [1, 4, 17, 88, 250, 9001]) {
			const s = playOut(seed);
			expect(s.phase).toBe('gameOver');
			expect(s.winner === 0 || s.winner === 1).toBe(true);
			expect(Math.max(s.scores[0], s.scores[1])).toBeGreaterThanOrEqual(250);
		}
	});
	it('exactly 13 tricks are distributed each hand', () => {
		let s = drain(spades.newGame(42));
		// play one full hand
		while (s.phase === 'bidding' || s.phase === 'playing') {
			const m = spades.suggest(s)!;
			s = drain(spades.apply(s, m));
		}
		expect(s.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
	});
});
