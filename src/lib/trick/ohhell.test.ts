import { describe, expect, it } from 'vitest';
import { ohhell, type OhHellState } from './ohhell';

function drain(s: OhHellState): OhHellState {
	let n: OhHellState | null;
	let g = 0;
	while ((n = ohhell.stepAuto(s)) !== null && g++ < 100) s = n;
	return s;
}
function playOut(seed: number): OhHellState {
	let s = drain(ohhell.newGame(seed));
	let g = 0;
	while (s.phase !== 'gameOver' && g++ < 5000) {
		const m = ohhell.suggest(s);
		if (!m) break;
		s = drain(ohhell.apply(s, m));
	}
	return s;
}

describe('oh hell deal', () => {
	const s = ohhell.newGame(9);
	it('starts at round one with a single card and a trump turn-up', () => {
		expect(s.handSize).toBe(1);
		expect(s.hands.map((h) => h.length)).toEqual([1, 1, 1, 1]);
		expect(s.trump).not.toBeNull();
	});
});

describe('oh hell full games', () => {
	it('run seven rounds and end with the highest score winning', () => {
		for (const seed of [1, 6, 23, 77, 500]) {
			const s = playOut(seed);
			expect(s.phase).toBe('gameOver');
			expect(s.roundIdx).toBe(6); // rounds 0..6
			expect(s.scores[s.winner!]).toBe(Math.max(...s.scores));
		}
	});

	it('hooks the dealer — table total never equals the hand size', () => {
		// drive several rounds and check the table after all four have bid
		let s = drain(ohhell.newGame(31));
		let guard = 0;
		while (s.phase !== 'gameOver' && guard++ < 60) {
			while (s.phase === 'bidding') {
				const m = ohhell.suggest(s)!;
				s = drain(ohhell.apply(s, m));
			}
			// after bidding completes (now playing), the sum of bids must avoid handSize
			const total = s.bids.reduce((a: number, b) => a + (b ?? 0), 0);
			expect(total).not.toBe(s.handSize);
			// finish the hand
			while (s.phase === 'playing') {
				const m = ohhell.suggest(s)!;
				s = drain(ohhell.apply(s, m));
			}
			if (s.phase === 'handComplete') s = drain(ohhell.apply(s, { type: 'continue' }));
		}
	});
});
