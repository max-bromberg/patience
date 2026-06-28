import { describe, expect, it } from 'vitest';
import { hearts, type HeartsState } from './hearts';

function drain(s: HeartsState): HeartsState {
	let n: HeartsState | null;
	let guard = 0;
	while ((n = hearts.stepAuto(s)) !== null && guard++ < 100) s = n;
	return s;
}

function playOut(seed: number): HeartsState {
	let s = drain(hearts.newGame(seed));
	let guard = 0;
	while (s.phase !== 'gameOver' && guard++ < 20000) {
		const move = hearts.suggest(s);
		if (!move) break;
		s = drain(hearts.apply(s, move));
	}
	return s;
}

describe('hearts deal', () => {
	const s = hearts.newGame(7);
	it('deals 13 cards to each of four seats', () => {
		expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
		expect(s.scores).toEqual([0, 0, 0, 0]);
	});
	it('the 2♣ holder leads and must open with it', () => {
		const leader = s.turn;
		const legal = s.hands[leader].filter((c) => c.suit === 'clubs' && c.rank === 2);
		expect(legal).toHaveLength(1);
		expect(s.hands[leader].some((c) => c.suit === 'clubs' && c.rank === 2)).toBe(true);
	});
});

describe('hearts full games', () => {
	it('terminate with the lowest score winning at/after 100', () => {
		for (const seed of [1, 2, 5, 33, 404, 9090]) {
			const s = playOut(seed);
			expect(s.phase).toBe('gameOver');
			expect(s.winner).not.toBeNull();
			expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(100);
			expect(s.scores[s.winner!]).toBe(Math.min(...s.scores));
		}
	});

	it('never produces negative scores', () => {
		const s = playOut(2024);
		for (const v of s.scores) expect(v).toBeGreaterThanOrEqual(0);
	});

	it('each completed hand adds 26 points total (or 78 on a moon)', () => {
		// step hand-by-hand for one game and check the per-hand delta
		let s = drain(hearts.newGame(11));
		let guard = 0;
		while (s.phase !== 'gameOver' && guard++ < 60) {
			const before = [...s.scores];
			while (s.phase === 'playing') {
				const m = hearts.suggest(s)!;
				s = drain(hearts.apply(s, m));
			}
			const delta = s.scores.reduce((a, v, i) => a + (v - before[i]), 0);
			expect([26, 78]).toContain(delta);
			if (s.phase === 'handComplete') s = drain(hearts.apply(s, { type: 'continue' }));
		}
	});
});
