import { describe, expect, it } from 'vitest';
import { applyMove, newGame, runAuto, suggestMove, teamOf, type EuchreState } from './euchre';

/** Play a whole game with the AI controlling the human seat too. */
function playOut(seed: number, variant?: string): EuchreState {
	let s = runAuto(newGame(seed, variant));
	let guard = 0;
	while (s.phase !== 'gameOver' && guard++ < 5000) {
		const move = suggestMove(s);
		if (!move) break;
		s = runAuto(applyMove(s, move));
	}
	return s;
}

describe('deal', () => {
	const s = newGame(42);
	it('deals five cards to each seat and turns up a card', () => {
		expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
		expect(s.upCard).not.toBeNull();
	});
	it('starts bidding with the human (South) since East deals', () => {
		expect(s.dealer).toBe(3);
		expect(s.phase === 'bidding1' || s.phase === 'bidding2' || s.phase === 'playing').toBe(true);
	});
});

describe('full games via AI', () => {
	it('always terminate with a winning team at 10+', () => {
		for (const seed of [1, 2, 3, 7, 99, 1234, 56789]) {
			const s = playOut(seed);
			expect(s.phase).toBe('gameOver');
			expect(s.winner).not.toBeNull();
			expect(s.scores[s.winner!]).toBeGreaterThanOrEqual(10);
		}
	});

	it('never lets the scoreboard exceed sane bounds', () => {
		const s = playOut(2024);
		expect(s.scores[0]).toBeLessThan(16);
		expect(s.scores[1]).toBeLessThan(16);
	});
});

describe('variants', () => {
	it('2-handed deals 5 cards to two seats and terminates with a 2-team winner', () => {
		const start = newGame(7, 'euchre2');
		expect(start.variant.seats).toBe(2);
		expect(start.hands).toHaveLength(2);
		expect(start.scores).toHaveLength(2);
		expect(start.dealer).toBe(1); // human (0) opens the bidding
		for (const seed of [1, 4, 22, 88, 305]) {
			const s = playOut(seed, 'euchre2');
			expect(s.phase).toBe('gameOver');
			expect(s.scores[s.winner!]).toBeGreaterThanOrEqual(10);
		}
	});

	it('3-handed cutthroat scores three independent teams and terminates', () => {
		const start = newGame(7, 'euchre3');
		expect(start.variant.seats).toBe(3);
		expect(start.scores).toHaveLength(3);
		for (const seed of [2, 9, 41, 130, 777]) {
			const s = playOut(seed, 'euchre3');
			expect(s.phase).toBe('gameOver');
			expect(s.winner).not.toBeNull();
			expect(s.scores[s.winner!]).toBeGreaterThanOrEqual(10);
			// no one can be wildly over the line
			for (const sc of s.scores) expect(sc).toBeLessThan(16);
		}
	});

	it('non-partner variants never let the AI go alone', () => {
		let s = runAuto(newGame(3, 'euchre2'));
		let guard = 0;
		while (s.phase !== 'gameOver' && guard++ < 5000) {
			expect(s.alone).toBe(false);
			expect(s.sitOut).toBeNull();
			const move = suggestMove(s);
			if (!move) break;
			s = runAuto(applyMove(s, move));
		}
	});
});

describe('bidding mechanics', () => {
	it('ordering up sets trump to the up-card suit and a maker', () => {
		// drive a game a few steps; find a state where trump got set
		let s = runAuto(newGame(5));
		let guard = 0;
		while (s.trump === null && guard++ < 50) {
			const m = suggestMove(s);
			if (!m) break;
			s = runAuto(applyMove(s, m));
		}
		expect(s.trump).not.toBeNull();
		expect(s.maker).not.toBeNull();
		// the maker's team is the one that called
		expect([0, 1]).toContain(teamOf(s.maker!));
	});
});
